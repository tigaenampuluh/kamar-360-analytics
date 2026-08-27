import { and, eq, isNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/db";
import { account, activityLogs, passwordResetRequests, session as sessionTable } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const passwordSchema = z.object({ newPassword: z.string().min(8).max(128) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminSession = await getApiSession(request);
  if (!adminSession) return unauthorized();
  if (!isAdminEmail(adminSession.user.email)) return forbidden();

  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success) return badRequest("ID permintaan tidak valid.");
  if (!parsedBody.success) return badRequest("Password baru harus terdiri dari 8–128 karakter.");

  const passwordHash = await hashPassword(parsedBody.data.newPassword);

  try {
    const completed = await db.transaction(async (transaction) => {
      const [recovery] = await transaction.update(passwordResetRequests)
        .set({ resolvedAt: new Date(), resolvedBy: adminSession.user.id })
        .where(and(
          eq(passwordResetRequests.id, parsedParams.data.id),
          isNull(passwordResetRequests.resolvedAt),
        ))
        .returning({
          userId: passwordResetRequests.userId,
          email: passwordResetRequests.email,
        });
      if (!recovery) return null;

      const [credential] = await transaction.select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, recovery.userId), eq(account.providerId, "credential")))
        .limit(1);
      if (!credential) throw new Error("CREDENTIAL_ACCOUNT_NOT_FOUND");

      await transaction.update(account)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(account.id, credential.id));
      await transaction.delete(sessionTable).where(eq(sessionTable.userId, recovery.userId));
      await transaction.insert(activityLogs).values({
        userId: adminSession.user.id,
        actorName: adminSession.user.name,
        actorInitials: initials(adminSession.user.name),
        action: "mengatur password sementara anggota",
        details: recovery.email,
      });

      return recovery;
    });

    if (!completed) return notFound("Pending password reset request");
    return Response.json({ data: { id: parsedParams.data.id, email: completed.email } });
  } catch (error) {
    if (error instanceof Error && error.message === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
      return badRequest("Akun ini tidak menggunakan login email dan password.");
    }
    throw error;
  }
}
