import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { deleteProject, findProjectById, updateProjectWithActivity } from "@/lib/services/project-service";
import {
  findWorkspaceMember,
  getProjectAccess,
  getProjectMembers,
  normalizeAssignments,
  validateAssignments,
} from "@/lib/services/project-collaboration-service";
import { notifyProjectAssignments } from "@/lib/services/notification-service";
import { updateProjectSchema } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function parseProjectId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseExpectedVersion(request: Request) {
  const value = request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', "");
  const version = value ? Number(value) : NaN;
  return Number.isInteger(version) && version > 0 ? version : null;
}

export async function GET(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseProjectId((await params).id);
  if (!id) return badRequest("Invalid project id");
  const project = await findProjectById(id);
  if (!project) return notFound("Project");
  const members = await getProjectMembers(id);
  return Response.json({ data: { ...project, members } });
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseProjectId((await params).id);
  if (!id) return badRequest("Invalid project id");
  const current = await findProjectById(id);
  if (!current) return notFound("Project");
  if (current.archivedAt) return forbidden("Pulihkan project dari arsip sebelum mengubahnya");
  const access = await getProjectAccess(id, session.user.id, session.user.email);
  if (!access.canEdit) return forbidden("Hanya Admin atau Lead project yang dapat mengubah project");
  const parsed = updateProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid project data", parsed.error.flatten());

  const input = parsed.data;
  const primaryPic = input.primaryPicUserId ? await findWorkspaceMember(input.primaryPicUserId) : null;
  if (input.primaryPicUserId && !primaryPic) return badRequest("PIC yang dipilih tidak ditemukan");
  if (input.memberAssignments && !await validateAssignments(input.memberAssignments)) return badRequest("Salah satu anggota project tidak ditemukan");
  const existingMembers = input.memberAssignments ? await getProjectMembers(id) : [];
  const { expectedVersion, memberAssignments, ...projectInput } = input;
  const normalizedAssignments = memberAssignments
    ? normalizeAssignments(memberAssignments, session.user.id, primaryPic?.id ?? current.primaryPicUserId)
    : undefined;
  const update = {
    ...projectInput,
    ...(primaryPic ? { pic: primaryPic.name, picInitials: initials(primaryPic.name), primaryPicUserId: primaryPic.id } : {}),
    ...(!primaryPic && input.primaryPicUserId === null ? { primaryPicUserId: null } : {}),
    ...(!primaryPic && input.pic ? { picInitials: input.picInitials || initials(input.pic) } : {}),
    ...(input.workingDocLink !== undefined ? { workingDocLink: input.workingDocLink || null } : {}),
  };
  const result = await updateProjectWithActivity(id, update, {
    userId: session.user.id,
    name: session.user.name,
    initials: initials(session.user.name),
  }, expectedVersion, normalizedAssignments);
  if (result.kind === "not-found") return notFound("Project");
  if (result.kind === "conflict") {
    const members = await getProjectMembers(id);
    return Response.json({
      error: "Project sudah diubah oleh pengguna lain. Data terbaru dimuat agar perubahan mereka tidak tertimpa.",
      code: "PROJECT_CONFLICT",
      data: { ...result.current, members },
    }, { status: 409 });
  }
  const project = result.project;
  if (normalizedAssignments) {
    const existingIds = new Set(existingMembers.map((member) => member.userId));
    await notifyProjectAssignments(project, session.user.id, session.user.name, normalizedAssignments.filter((member) => !existingIds.has(member.userId)).map((member) => member.userId));
    const members = await getProjectMembers(id);
    return Response.json({ data: { ...project, members } });
  }
  const members = await getProjectMembers(id);
  return Response.json({ data: { ...project, members } });
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseProjectId((await params).id);
  if (!id) return badRequest("Invalid project id");
  const project = await findProjectById(id);
  if (!project) return notFound("Project");
  const access = await getProjectAccess(id, session.user.id, session.user.email);
  if (!access.canDelete) return forbidden("Hanya Admin atau Lead project yang dapat menghapus project");
  const expectedVersion = parseExpectedVersion(request);
  if (!expectedVersion) return badRequest("Versi project wajib dikirim untuk mencegah konflik data");
  const deleted = await deleteProject(id, expectedVersion);
  if (!deleted) {
    const latest = await findProjectById(id);
    if (!latest) return notFound("Project");
    return Response.json({ error: "Project sudah diubah oleh pengguna lain dan belum dihapus.", code: "PROJECT_CONFLICT", data: latest }, { status: 409 });
  }
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), action: "menghapus project", details: project.title });
  return new Response(null, { status: 204 });
}
