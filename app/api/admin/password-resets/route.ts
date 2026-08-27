import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetRequests, user } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { forbidden, getApiSession, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  if (!isAdminEmail(session.user.email)) return forbidden();

  const requests = await db.select({
    id: passwordResetRequests.id,
    userId: passwordResetRequests.userId,
    email: passwordResetRequests.email,
    name: user.name,
    requestedAt: passwordResetRequests.requestedAt,
  }).from(passwordResetRequests)
    .innerJoin(user, eq(user.id, passwordResetRequests.userId))
    .where(isNull(passwordResetRequests.resolvedAt))
    .orderBy(desc(passwordResetRequests.requestedAt));

  return Response.json({ data: requests });
}
