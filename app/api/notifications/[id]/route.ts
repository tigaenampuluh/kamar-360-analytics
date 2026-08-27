import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { badRequest, getApiSession, notFound, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return badRequest("Invalid notification id");

  const [notification] = await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)))
    .returning();

  return notification ? Response.json({ data: notification }) : notFound("Notification");
}
