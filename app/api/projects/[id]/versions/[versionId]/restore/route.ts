import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projectVersions } from "@/db/schema";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { getProjectAccess, validateAssignments } from "@/lib/services/project-collaboration-service";
import { findProjectById, updateProjectWithActivity } from "@/lib/services/project-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; versionId: string }> };
const restoreSchema = z.object({ expectedVersion: z.number().int().positive() });

export async function POST(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const values = await params;
  const projectId = Number(values.id);
  const versionId = Number(values.versionId);
  if (!Number.isInteger(projectId) || projectId < 1 || !Number.isInteger(versionId) || versionId < 1) return badRequest("Invalid version id");
  const parsed = restoreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Versi project terbaru wajib dikirim", parsed.error.flatten());
  const current = await findProjectById(projectId);
  if (!current) return notFound("Project");
  const access = await getProjectAccess(projectId, session.user.id, session.user.email);
  if (!access.canEdit) return forbidden("Hanya Admin atau Lead project yang dapat memulihkan versi");
  const [target] = await db.select().from(projectVersions)
    .where(and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, projectId)))
    .limit(1);
  if (!target) return notFound("Project version");
  if (!await validateAssignments(target.snapshot.members)) return Response.json({ error: "Versi ini merujuk ke akun anggota yang sudah tidak tersedia." }, { status: 409 });

  const snapshot = target.snapshot;
  const result = await updateProjectWithActivity(projectId, {
    title: snapshot.title,
    description: snapshot.description,
    pic: snapshot.pic,
    picInitials: snapshot.picInitials,
    primaryPicUserId: snapshot.primaryPicUserId,
    deadline: new Date(snapshot.deadline),
    doneAt: snapshot.doneAt ? new Date(snapshot.doneAt) : null,
    status: snapshot.status,
    priority: snapshot.priority,
    category: snapshot.category,
    workingDocLink: snapshot.workingDocLink,
    archivedAt: snapshot.archivedAt ? new Date(snapshot.archivedAt) : null,
    archivedBy: snapshot.archivedAt ? session.user.id : null,
  }, {
    userId: session.user.id,
    name: session.user.name,
    initials: initials(session.user.name),
  }, parsed.data.expectedVersion, snapshot.members, "restore");
  if (result.kind === "not-found") return notFound("Project");
  if (result.kind === "conflict") return Response.json({ error: "Project berubah sebelum versi dipulihkan. Muat ulang lalu coba lagi.", code: "PROJECT_CONFLICT", data: result.current }, { status: 409 });
  return Response.json({ data: result.project, restoredFromVersion: target.version });
}
