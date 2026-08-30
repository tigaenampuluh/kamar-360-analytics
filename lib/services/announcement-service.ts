import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { announcements, notifications, user } from "@/db/schema";

type AnnouncementRecord = typeof announcements.$inferSelect;

function activeAnnouncementCondition(now: Date) {
  return and(
    eq(announcements.active, true),
    lte(announcements.startsAt, now),
    or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
  );
}

export async function publishAnnouncementNotifications(announcement: AnnouncementRecord) {
  const recipients = await db.select({ id: user.id }).from(user);
  if (recipients.length === 0) return;
  await db.insert(notifications).values(recipients.map((recipient) => ({
    userId: recipient.id,
    announcementId: announcement.id,
    kind: "announcement" as const,
    title: announcement.title,
    message: announcement.message,
    targetView: "dashboard" as const,
    dedupeKey: `announcement:${announcement.id}`,
  }))).onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] });
}

export async function syncActiveAnnouncementsForUser(userId: string, now = new Date()) {
  const active = await db.select().from(announcements).where(activeAnnouncementCondition(now));
  if (active.length === 0) return;
  await db.insert(notifications).values(active.map((announcement) => ({
    userId,
    announcementId: announcement.id,
    kind: "announcement" as const,
    title: announcement.title,
    message: announcement.message,
    targetView: "dashboard" as const,
    dedupeKey: `announcement:${announcement.id}`,
  }))).onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] });
}

export async function listActiveAnnouncementsForUser(userId: string, now = new Date()) {
  await syncActiveAnnouncementsForUser(userId, now);
  return db.select({
    id: announcements.id,
    notificationId: notifications.id,
    title: announcements.title,
    message: announcements.message,
    priority: announcements.priority,
    startsAt: announcements.startsAt,
    endsAt: announcements.endsAt,
    readAt: notifications.readAt,
  }).from(announcements)
    .innerJoin(notifications, and(eq(notifications.announcementId, announcements.id), eq(notifications.userId, userId)))
    .where(activeAnnouncementCondition(now));
}
