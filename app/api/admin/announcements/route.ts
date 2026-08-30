import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, announcements, notifications } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { badRequest, forbidden, getApiSession, initials, unauthorized } from "@/lib/api";
import { publishAnnouncementNotifications } from "@/lib/services/announcement-service";

export const runtime = "nodejs";

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(2000),
  priority: z.enum(["info", "important", "urgent"]).default("info"),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
}).refine((value) => !value.endsAt || value.endsAt > (value.startsAt ?? new Date()), {
  message: "Waktu berakhir harus setelah waktu mulai",
  path: ["endsAt"],
});

async function requireAdmin(request: Request) {
  const session = await getApiSession(request);
  if (!session) return { response: unauthorized() } as const;
  if (!isAdminEmail(session.user.email)) return { response: forbidden() } as const;
  return { session } as const;
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const rows = await db.select({
    id: announcements.id,
    title: announcements.title,
    message: announcements.message,
    priority: announcements.priority,
    startsAt: announcements.startsAt,
    endsAt: announcements.endsAt,
    active: announcements.active,
    createdAt: announcements.createdAt,
    updatedAt: announcements.updatedAt,
    recipientCount: sql<number>`count(${notifications.id})::int`,
    readCount: sql<number>`count(${notifications.id}) filter (where ${isNotNull(notifications.readAt)})::int`,
  }).from(announcements)
    .leftJoin(notifications, eq(notifications.announcementId, announcements.id))
    .groupBy(announcements.id)
    .orderBy(desc(announcements.createdAt));
  return Response.json({ data: rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const parsed = announcementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Data pengumuman belum valid", parsed.error.flatten());
  const [announcement] = await db.transaction(async (transaction) => {
    const rows = await transaction.insert(announcements).values({
      ...parsed.data,
      startsAt: parsed.data.startsAt ?? new Date(),
      endsAt: parsed.data.endsAt ?? null,
      createdBy: access.session.user.id,
    }).returning();
    await transaction.insert(activityLogs).values({
      userId: access.session.user.id,
      actorName: access.session.user.name,
      actorInitials: initials(access.session.user.name),
      action: "menerbitkan pengumuman",
      details: rows[0].title,
    });
    return rows;
  });
  await publishAnnouncementNotifications(announcement);
  return Response.json({ data: announcement }, { status: 201 });
}
