import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { announcements, notifications } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { badRequest, forbidden, getApiSession, notFound, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  message: z.string().trim().min(3).max(2000).optional(),
  priority: z.enum(["info", "important", "urgent"]).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "No fields supplied");

export async function PATCH(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  if (!isAdminEmail(session.user.email)) return forbidden();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return badRequest("Invalid announcement id");
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Data pengumuman belum valid", parsed.error.flatten());
  const [updated] = await db.update(announcements).set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(announcements.id, id)).returning();
  if (!updated) return notFound("Announcement");
  if (parsed.data.title !== undefined || parsed.data.message !== undefined) {
    await db.update(notifications).set({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.message !== undefined ? { message: parsed.data.message } : {}),
    }).where(eq(notifications.announcementId, id));
  }
  return Response.json({ data: updated });
}
