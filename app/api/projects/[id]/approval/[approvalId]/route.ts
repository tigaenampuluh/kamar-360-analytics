import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, projectCompletionApprovals } from "@/db/schema";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { getLatestCompletionApproval, getProjectAccess } from "@/lib/services/project-collaboration-service";
import { notifyCompletionResolved } from "@/lib/services/notification-service";
import { findProjectById, updateProjectWithActivity } from "@/lib/services/project-service";
import { projectCompletionReviewSchema } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; approvalId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const values = await params;
  const projectId = Number(values.id);
  const approvalId = Number(values.approvalId);
  if (!Number.isInteger(projectId) || projectId < 1 || !Number.isInteger(approvalId) || approvalId < 1) return badRequest("Invalid approval id");
  const project = await findProjectById(projectId);
  if (!project) return notFound("Project");
  const access = await getProjectAccess(projectId, session.user.id, session.user.email);
  if (!access.canApproveCompletion) return forbidden("Hanya Admin atau Lead project yang dapat mereview penyelesaian");
  const parsed = projectCompletionReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid approval review", parsed.error.flatten());
  const [approval] = await db.select().from(projectCompletionApprovals)
    .where(and(
      eq(projectCompletionApprovals.id, approvalId),
      eq(projectCompletionApprovals.projectId, projectId),
      eq(projectCompletionApprovals.status, "pending"),
    )).limit(1);
  if (!approval) return notFound("Pending approval");

  if (parsed.data.decision === "approved") {
    const updateResult = await updateProjectWithActivity(projectId, { status: "Done" }, {
      userId: session.user.id,
      name: session.user.name,
      initials: initials(session.user.name),
    }, project.version);
    if (updateResult.kind === "not-found") return notFound("Project");
    if (updateResult.kind === "conflict") {
      return Response.json({ error: "Project berubah ketika approval diproses. Muat ulang detail project sebelum mencoba lagi.", code: "PROJECT_CONFLICT", data: updateResult.current }, { status: 409 });
    }
  }

  await db.transaction(async (transaction) => {
    await transaction.update(projectCompletionApprovals).set({
      status: parsed.data.decision,
      reviewNote: parsed.data.note,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    }).where(eq(projectCompletionApprovals.id, approvalId));
    await transaction.insert(activityLogs).values({
      userId: session.user.id,
      actorName: session.user.name,
      actorInitials: initials(session.user.name),
      projectId,
      action: parsed.data.decision === "approved" ? "menyetujui penyelesaian" : "menolak penyelesaian",
      details: project.title,
    });
  });
  await notifyCompletionResolved(project, session.user.id, session.user.name, approval.requestedBy, parsed.data.decision);
  return Response.json({ data: await getLatestCompletionApproval(projectId) });
}
