import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { session as sessionTable, user } from "@/db/schema";
import { getApiSession, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

const ACTIVE_WINDOW_MS = 5 * 60_000;

export async function GET(request: Request) {
  const currentSession = await getApiSession(request);
  if (!currentSession) return unauthorized();

  const now = new Date();
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MS);
  await db.update(sessionTable)
    .set({ updatedAt: now })
    .where(eq(sessionTable.userId, currentSession.user.id));

  const rows = await db.select({
    id: user.id,
    name: user.name,
    image: user.image,
    lastSeenAt: sessionTable.updatedAt,
  }).from(sessionTable)
    .innerJoin(user, eq(sessionTable.userId, user.id))
    .where(and(gt(sessionTable.expiresAt, now), gt(sessionTable.updatedAt, activeSince)))
    .orderBy(desc(sessionTable.updatedAt))
    .limit(20);

  const seen = new Set<string>();
  const activeMembers = rows.filter((member) => {
    if (seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  }).map((member) => ({ ...member, isCurrentUser: member.id === currentSession.user.id }));

  return Response.json({ data: activeMembers, activeWindowSeconds: ACTIVE_WINDOW_MS / 1_000 }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
