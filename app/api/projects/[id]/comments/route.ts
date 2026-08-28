import { db } from "@/db";
import { projectCommentMentions, projectComments } from "@/db/schema";
import { badRequest, forbidden, getApiSession, notFound, unauthorized } from "@/lib/api";
import { getProjectAccess, getProjectComments, validateAssignments } from "@/lib/services/project-collaboration-service";
import { findProjectById } from "@/lib/services/project-service";
import { notifyProjectMentions } from "@/lib/services/notification-service";
import { projectCommentSchema } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return badRequest("Invalid project id");
  const project = await findProjectById(id);
  if (!project) return notFound("Project");
  const access = await getProjectAccess(id, session.user.id, session.user.email);
  if (!access.canComment) return forbidden("Viewer dan non-anggota tidak dapat menambahkan komentar");
  const parsed = projectCommentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid comment data", parsed.error.flatten());
  const mentionUserIds = Array.from(new Set(parsed.data.mentionUserIds)).filter((userId) => userId !== session.user.id);
  if (!await validateAssignments(mentionUserIds.map((userId) => ({ userId, role: "Anggota" as const })))) return badRequest("Salah satu akun mention tidak ditemukan");

  await db.transaction(async (transaction) => {
    const [comment] = await transaction.insert(projectComments).values({
      projectId: id,
      authorId: session.user.id,
      body: parsed.data.body,
    }).returning({ id: projectComments.id });
    if (mentionUserIds.length > 0) {
      await transaction.insert(projectCommentMentions).values(mentionUserIds.map((userId) => ({ commentId: comment.id, userId })));
    }
  });
  await notifyProjectMentions(project, session.user.id, session.user.name, mentionUserIds);
  return Response.json({ data: await getProjectComments(id) }, { status: 201 });
}
