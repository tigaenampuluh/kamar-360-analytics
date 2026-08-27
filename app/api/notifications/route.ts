import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { badRequest, getApiSession, unauthorized } from "@/lib/api";
import { ensureUpcomingNotifications } from "@/lib/services/notification-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return badRequest("Limit must be an integer between 1 and 50");

  const unreadParam = url.searchParams.get("unreadOnly");
  if (unreadParam && !["true", "false"].includes(unreadParam)) return badRequest("unreadOnly must be true or false");

  await ensureUpcomingNotifications(session.user.id);
  const conditions: SQL[] = [eq(notifications.userId, session.user.id)];
  if (unreadParam === "true") conditions.push(isNull(notifications.readAt));

  const [rows, [unreadResult]] = await Promise.all([
    db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt))),
  ]);

  return Response.json({ data: rows, unreadCount: Number(unreadResult?.count ?? 0) });
}

export async function PATCH(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();

  const updated = await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)))
    .returning({ id: notifications.id });

  return Response.json({ data: { updated: updated.length } });
}
