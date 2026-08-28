import { db } from "@/db";
import { activityLogs, projects } from "@/db/schema";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { getProjectAccess } from "@/lib/services/project-collaboration-service";
import { findProjectById } from "@/lib/services/project-service";
import { and, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

async function changeArchiveState(request: Request, context: Context, archived: boolean) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1) return badRequest("Invalid project id");
  const project = await findProjectById(id);
  if (!project) return notFound("Project");
  const access = await getProjectAccess(id, session.user.id, session.user.email);
  if (!access.canEdit) return forbidden("Hanya Admin atau Lead project yang dapat mengelola arsip");
  const expectedVersion = Number(request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', ""));
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return badRequest("Versi project wajib dikirim untuk mencegah konflik data");
  const [updated] = await db.transaction(async (transaction) => {
    const rows = await transaction.update(projects).set({
      archivedAt: archived ? new Date() : null,
      archivedBy: archived ? session.user.id : null,
      version: sql`${projects.version} + 1`,
      updatedAt: new Date(),
    }).where(and(eq(projects.id, id), eq(projects.version, expectedVersion))).returning();
    if (!rows[0]) return rows;
    await transaction.insert(activityLogs).values({
      userId: session.user.id,
      actorName: session.user.name,
      actorInitials: initials(session.user.name),
      projectId: id,
      action: archived ? "mengarsipkan project" : "memulihkan project",
      details: project.title,
    });
    return rows;
  });
  if (!updated) {
    const latest = await findProjectById(id);
    if (!latest) return notFound("Project");
    return Response.json({ error: "Project sudah diubah oleh pengguna lain. Status arsip tidak diubah.", code: "PROJECT_CONFLICT", data: latest }, { status: 409 });
  }
  return Response.json({ data: updated });
}

export function POST(request: Request, context: Context) {
  return changeArchiveState(request, context, true);
}

export function DELETE(request: Request, context: Context) {
  return changeArchiveState(request, context, false);
}
