import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { deleteProject, findProjectById, updateProjectWithActivity } from "@/lib/services/project-service";
import {
  findWorkspaceMember,
  getProjectAccess,
  getProjectMembers,
  normalizeAssignments,
  syncProjectMembers,
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
  const access = await getProjectAccess(id, session.user.id, session.user.email);
  if (!access.canEdit) return forbidden("Hanya Admin atau Lead project yang dapat mengubah project");
  const parsed = updateProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid project data", parsed.error.flatten());

  const input = parsed.data;
  const primaryPic = input.primaryPicUserId ? await findWorkspaceMember(input.primaryPicUserId) : null;
  if (input.primaryPicUserId && !primaryPic) return badRequest("PIC yang dipilih tidak ditemukan");
  if (input.memberAssignments && !await validateAssignments(input.memberAssignments)) return badRequest("Salah satu anggota project tidak ditemukan");
  const existingMembers = input.memberAssignments ? await getProjectMembers(id) : [];
  const { memberAssignments, ...projectInput } = input;
  const update = {
    ...projectInput,
    ...(primaryPic ? { pic: primaryPic.name, picInitials: initials(primaryPic.name), primaryPicUserId: primaryPic.id } : {}),
    ...(!primaryPic && input.primaryPicUserId === null ? { primaryPicUserId: null } : {}),
    ...(!primaryPic && input.pic ? { picInitials: input.picInitials || initials(input.pic) } : {}),
    ...(input.workingDocLink !== undefined ? { workingDocLink: input.workingDocLink || null } : {}),
  };
  const project = await updateProjectWithActivity(id, update, {
    userId: session.user.id,
    name: session.user.name,
    initials: initials(session.user.name),
  });
  if (!project) return notFound("Project");
  if (memberAssignments) {
    const normalized = normalizeAssignments(memberAssignments, session.user.id, primaryPic?.id ?? current.primaryPicUserId);
    await syncProjectMembers(id, normalized, session.user.id);
    const existingIds = new Set(existingMembers.map((member) => member.userId));
    await notifyProjectAssignments(project, session.user.id, session.user.name, normalized.filter((member) => !existingIds.has(member.userId)).map((member) => member.userId));
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
  await deleteProject(id);
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), action: "menghapus project", details: project.title });
  return new Response(null, { status: 204 });
}
