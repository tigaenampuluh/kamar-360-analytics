import { randomUUID } from "node:crypto";
import { and, eq, gte, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { agendas, notifications, projectMemberships, projects, user } from "@/db/schema";

type NotificationTarget = typeof notifications.targetView.enumValues[number];
type NotificationKind = typeof notifications.kind.enumValues[number];
type ProjectRecord = typeof projects.$inferSelect;
type AgendaRecord = typeof agendas.$inferSelect;

const notificationDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function readableWibDate(value: Date) {
  return `${notificationDateFormatter.format(value).replaceAll(".", ":")} WIB`;
}

type WorkspaceNotification = {
  actorUserId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  targetView: NotificationTarget;
  projectId?: number | null;
  agendaId?: number | null;
};

async function createTargetedNotifications(userIds: string[], input: Omit<WorkspaceNotification, "actorUserId"> & { actorUserId: string }) {
  const recipients = Array.from(new Set(userIds)).filter((userId) => userId !== input.actorUserId);
  if (recipients.length === 0) return;
  const eventId = randomUUID();
  await db.insert(notifications).values(recipients.map((userId) => ({
    userId,
    projectId: input.projectId ?? null,
    agendaId: input.agendaId ?? null,
    kind: input.kind,
    title: input.title,
    message: input.message,
    targetView: input.targetView,
    dedupeKey: `event:${eventId}`,
  })));
}

async function getProjectRecipientIds(project: ProjectRecord) {
  const memberships = await db.select({ userId: projectMemberships.userId })
    .from(projectMemberships)
    .where(eq(projectMemberships.projectId, project.id));
  return Array.from(new Set([
    ...memberships.map((membership) => membership.userId),
    ...(project.primaryPicUserId ? [project.primaryPicUserId] : []),
  ]));
}

async function getAgendaRecipientIds(agenda: AgendaRecord) {
  if (agenda.projectId) {
    const [project] = await db.select().from(projects).where(eq(projects.id, agenda.projectId)).limit(1);
    return project ? getProjectRecipientIds(project) : [];
  }
  const matchingMembers = await db.select({ id: user.id }).from(user)
    .where(sql`lower(trim(${user.name})) = lower(trim(${agenda.pic}))`);
  return matchingMembers.map((member) => member.id);
}

export async function notifyProjectCreated(project: ProjectRecord, actorUserId: string, actorName: string) {
  return createTargetedNotifications(await getProjectRecipientIds(project), {
    actorUserId,
    kind: "project",
    title: "Project baru ditambahkan",
    message: `${actorName} menambahkan ${project.title}.`,
    targetView: "tracker",
    projectId: project.id,
  });
}

export async function notifyProjectUpdated(project: ProjectRecord, actorUserId: string, actorName: string, detail: string) {
  return createTargetedNotifications(await getProjectRecipientIds(project), {
    actorUserId,
    kind: "activity",
    title: "Project diperbarui",
    message: `${actorName} memperbarui ${project.title}: ${detail}.`,
    targetView: "tracker",
    projectId: project.id,
  });
}

export function notifyProjectAssignments(project: ProjectRecord, actorUserId: string, actorName: string, assignedUserIds: string[]) {
  return createTargetedNotifications(assignedUserIds, {
    actorUserId,
    kind: "assignment",
    title: "Anda ditugaskan ke project",
    message: `${actorName} menambahkan Anda ke ${project.title}.`,
    targetView: "tracker",
    projectId: project.id,
  });
}

export function notifyProjectMentions(project: ProjectRecord, actorUserId: string, actorName: string, mentionedUserIds: string[]) {
  return createTargetedNotifications(mentionedUserIds, {
    actorUserId,
    kind: "mention",
    title: "Anda disebut dalam komentar",
    message: `${actorName} menyebut Anda di ${project.title}.`,
    targetView: "tracker",
    projectId: project.id,
  });
}

export function notifyCompletionRequested(project: ProjectRecord, actorUserId: string, actorName: string, reviewerUserIds: string[]) {
  return createTargetedNotifications(reviewerUserIds, {
    actorUserId,
    kind: "approval",
    title: "Persetujuan penyelesaian diperlukan",
    message: `${actorName} meminta persetujuan untuk menyelesaikan ${project.title}.`,
    targetView: "tracker",
    projectId: project.id,
  });
}

export function notifyCompletionResolved(project: ProjectRecord, actorUserId: string, actorName: string, requesterUserId: string, decision: "approved" | "rejected") {
  return createTargetedNotifications([requesterUserId], {
    actorUserId,
    kind: "approval",
    title: decision === "approved" ? "Penyelesaian project disetujui" : "Penyelesaian project perlu diperbaiki",
    message: `${actorName} ${decision === "approved" ? "menyetujui" : "menolak"} penyelesaian ${project.title}.`,
    targetView: "tracker",
    projectId: project.id,
  });
}

export async function notifyAgendaChanged(agenda: AgendaRecord, actorUserId: string, actorName: string, action: "ditambahkan" | "diperbarui") {
  return createTargetedNotifications(await getAgendaRecipientIds(agenda), {
    actorUserId,
    kind: "agenda",
    title: `Agenda ${action}`,
    message: `${actorName} ${action === "ditambahkan" ? "menambahkan" : "memperbarui"} agenda ${agenda.title}.`,
    targetView: "calendar",
    projectId: agenda.projectId,
    agendaId: agenda.id,
  });
}

export async function ensureUpcomingNotifications(userId: string, now = new Date()) {
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [currentUser] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
  if (!currentUser) return;
  const involvedInProject = (projectId: typeof projects.id, primaryPicUserId: typeof projects.primaryPicUserId) => or(
    eq(primaryPicUserId, userId),
    sql`exists (
      select 1 from ${projectMemberships} membership
      where membership.project_id = ${projectId}
        and membership.user_id = ${userId}
    )`,
  );
  const [dueProjects, dueAgendas] = await Promise.all([
    db.select().from(projects).where(and(
      gte(projects.deadline, now),
      lte(projects.deadline, windowEnd),
      ne(projects.status, "Done"),
      involvedInProject(projects.id, projects.primaryPicUserId),
    )),
    db.select().from(agendas).where(and(
      gte(agendas.startTime, now),
      lte(agendas.startTime, windowEnd),
      or(
        and(
          isNotNull(agendas.projectId),
          sql`exists (
            select 1 from ${projects} related_project
            where related_project.id = ${agendas.projectId}
              and (
                related_project.primary_pic_user_id = ${userId}
                or exists (
                  select 1 from ${projectMemberships} membership
                  where membership.project_id = related_project.id
                    and membership.user_id = ${userId}
                )
              )
          )`,
        ),
        and(isNull(agendas.projectId), sql`lower(trim(${agendas.pic})) = lower(trim(${currentUser.name}))`),
      ),
    )),
  ]);

  await db.execute(sql`
    delete from ${notifications} notification
    using ${projects} related_project
    where notification.user_id = ${userId}
      and notification.project_id = related_project.id
      and notification.kind in ('deadline', 'project', 'activity', 'agenda')
      and related_project.primary_pic_user_id is distinct from ${userId}
      and not exists (
        select 1 from ${projectMemberships} membership
        where membership.project_id = related_project.id
          and membership.user_id = ${userId}
      )
  `);
  await db.execute(sql`
    delete from ${notifications} notification
    using ${agendas} related_agenda
    where notification.user_id = ${userId}
      and notification.agenda_id = related_agenda.id
      and notification.kind = 'agenda'
      and related_agenda.project_id is null
      and lower(trim(related_agenda.pic)) <> lower(trim(${currentUser.name}))
  `);

  const values: Array<typeof notifications.$inferInsert> = [
    ...dueProjects.map((project) => ({
      userId,
      projectId: project.id,
      kind: "deadline" as const,
      title: "Deadline project mendekat",
      message: `${project.title} dijadwalkan selesai pada ${readableWibDate(project.deadline)}.`,
      targetView: "tracker" as const,
      dedupeKey: `deadline:${project.id}:${project.deadline.toISOString()}`,
    })),
    ...dueAgendas.map((agenda) => ({
      userId,
      projectId: agenda.projectId,
      agendaId: agenda.id,
      kind: "agenda" as const,
      title: "Agenda segera dimulai",
      message: `${agenda.title} dijadwalkan pada ${readableWibDate(agenda.startTime)}.`,
      targetView: "calendar" as const,
      dedupeKey: `agenda:${agenda.id}:${agenda.startTime.toISOString()}`,
    })),
  ];

  if (values.length > 0) {
    await db.insert(notifications).values(values).onConflictDoUpdate({
      target: [notifications.userId, notifications.dedupeKey],
      set: {
        title: sql`excluded.title`,
        message: sql`excluded.message`,
        targetView: sql`excluded.target_view`,
      },
    });
  }
}
