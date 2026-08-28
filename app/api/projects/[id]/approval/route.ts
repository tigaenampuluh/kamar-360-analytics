import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, projectCompletionApprovals } from "@/db/schema";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import {
  getLatestCompletionApproval,
  getProjectAccess,
  getProjectMembers,
  listWorkspaceMembers,
} from "@/lib/services/project-collaboration-service";
import { notifyCompletionRequested } from "@/lib/services/notification-service";
import { findProjectById } from "@/lib/services/project-service";
import { projectCompletionRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return badRequest("Invalid project id");
  const project = await findProjectById(id);
  if (!project) return notFound("Project");
  if (project.status === "Done") return badRequest("Project sudah berstatus Done");
  const access = await getProjectAccess(id, session.user.id, session.user.email);
  if (!access.canRequestCompletion) return forbidden("Hanya Lead atau Anggota project yang dapat meminta penyelesaian");
  const parsed = projectCompletionRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Invalid completion request", parsed.error.flatten());
  if (access.canApproveCompletion) {
    return Response.json({ error: "Admin atau Lead dapat menyelesaikan project langsung dari status project" }, { status: 409 });
  }
  const [pending] = await db.select({ id: projectCompletionApprovals.id }).from(projectCompletionApprovals)
    .where(and(eq(projectCompletionApprovals.projectId, id), eq(projectCompletionApprovals.status, "pending")))
    .limit(1);
  if (pending) return Response.json({ error: "Permintaan persetujuan masih menunggu review" }, { status: 409 });

  await db.transaction(async (transaction) => {
    await transaction.insert(projectCompletionApprovals).values({
      projectId: id,
      requestedBy: session.user.id,
      requestNote: parsed.data.note,
    });
    await transaction.insert(activityLogs).values({
      userId: session.user.id,
      actorName: session.user.name,
      actorInitials: initials(session.user.name),
      projectId: id,
      action: "meminta persetujuan penyelesaian",
      details: project.title,
    });
  });
  const [members, workspaceMembers] = await Promise.all([getProjectMembers(id), listWorkspaceMembers()]);
  const reviewerIds = [
    ...members.filter((member) => member.role === "Lead").map((member) => member.userId),
    ...workspaceMembers.filter((member) => member.workspaceRole === "Admin").map((member) => member.id),
  ];
  await notifyCompletionRequested(project, session.user.id, session.user.name, reviewerIds);
  return Response.json({ data: await getLatestCompletionApproval(id) }, { status: 201 });
}
