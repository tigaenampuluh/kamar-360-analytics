import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, signupInvites } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  if (!isAdminEmail(session.user.email)) return forbidden();
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return badRequest("ID undangan tidak valid");

  const invite = await db.transaction(async (transaction) => {
    const [revoked] = await transaction.update(signupInvites)
      .set({ revokedAt: new Date() })
      .where(and(eq(signupInvites.id, id), isNull(signupInvites.revokedAt)))
      .returning();
    if (!revoked) return null;
    await transaction.insert(activityLogs).values({
      userId: session.user.id,
      actorName: session.user.name,
      actorInitials: initials(session.user.name),
      action: "menonaktifkan undangan anggota",
      details: revoked.email,
    });
    return revoked;
  });

  return invite ? Response.json({ data: invite }) : notFound("Invitation");
}
