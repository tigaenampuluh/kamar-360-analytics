import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLogs,
  announcements,
  agendas,
  assets,
  notifications,
  projectCommentMentions,
  projectComments,
  projectCompletionApprovals,
  projectMemberships,
  projectVersions,
  projects,
  user,
  workspaceBackups,
} from "@/db/schema";

export const WORKSPACE_BACKUP_FORMAT = "360-center-of-research-backup";
export const WORKSPACE_BACKUP_SCHEMA_VERSION = 1;

type Jsonify<T> = T extends Date
  ? string
  : T extends Array<infer Item>
    ? Array<Jsonify<Item>>
    : T extends object
      ? { [Key in keyof T]: Jsonify<T[Key]> }
      : T;

type WorkspaceSnapshot = {
  projects: Array<Jsonify<typeof projects.$inferSelect>>;
  projectMemberships: Array<Jsonify<typeof projectMemberships.$inferSelect>>;
  projectComments: Array<Jsonify<typeof projectComments.$inferSelect>>;
  projectCommentMentions: Array<Jsonify<typeof projectCommentMentions.$inferSelect>>;
  projectCompletionApprovals: Array<Jsonify<typeof projectCompletionApprovals.$inferSelect>>;
  agendas: Array<Jsonify<typeof agendas.$inferSelect>>;
  assets: Array<Jsonify<typeof assets.$inferSelect>>;
  activityLogs: Array<Jsonify<typeof activityLogs.$inferSelect>>;
  announcements?: Array<Jsonify<typeof announcements.$inferSelect>>;
  projectVersions?: Array<Jsonify<typeof projectVersions.$inferSelect>>;
};

export type WorkspaceBackupEnvelope = {
  format: typeof WORKSPACE_BACKUP_FORMAT;
  schemaVersion: typeof WORKSPACE_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  data: WorkspaceSnapshot;
};

type BackupActor = { id: string; name: string; initials: string };
type QueryExecutor = Pick<typeof db, "select">;

function date(value: string | null) {
  return value ? new Date(value) : null;
}

function requiredDate(value: string) {
  return new Date(value);
}

async function readSnapshot(executor: QueryExecutor): Promise<WorkspaceSnapshot> {
  const [projectRows, membershipRows, commentRows, mentionRows, approvalRows, agendaRows, assetRows, activityRows, announcementRows, versionRows] = await Promise.all([
    executor.select().from(projects),
    executor.select().from(projectMemberships),
    executor.select().from(projectComments),
    executor.select().from(projectCommentMentions),
    executor.select().from(projectCompletionApprovals),
    executor.select().from(agendas),
    executor.select().from(assets),
    executor.select().from(activityLogs),
    executor.select().from(announcements),
    executor.select().from(projectVersions),
  ]);
  return JSON.parse(JSON.stringify({
    projects: projectRows,
    projectMemberships: membershipRows,
    projectComments: commentRows,
    projectCommentMentions: mentionRows,
    projectCompletionApprovals: approvalRows,
    agendas: agendaRows,
    assets: assetRows,
    activityLogs: activityRows,
    announcements: announcementRows,
    projectVersions: versionRows,
  })) as WorkspaceSnapshot;
}

function summarize(snapshot: WorkspaceSnapshot) {
  return {
    projects: snapshot.projects.length,
    members: snapshot.projectMemberships.length,
    comments: snapshot.projectComments.length,
    approvals: snapshot.projectCompletionApprovals.length,
    agendas: snapshot.agendas.length,
    assets: snapshot.assets.length,
    activities: snapshot.activityLogs.length,
    announcements: snapshot.announcements?.length ?? 0,
    versions: snapshot.projectVersions?.length ?? 0,
  };
}

function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return [
    "projects",
    "projectMemberships",
    "projectComments",
    "projectCommentMentions",
    "projectCompletionApprovals",
    "agendas",
    "assets",
    "activityLogs",
  ].every((key) => Array.isArray(snapshot[key]));
}

export async function listWorkspaceBackups() {
  return db.select({
    id: workspaceBackups.id,
    label: workspaceBackups.label,
    schemaVersion: workspaceBackups.schemaVersion,
    summary: workspaceBackups.summary,
    createdBy: workspaceBackups.createdBy,
    createdByName: user.name,
    createdAt: workspaceBackups.createdAt,
    restoredAt: workspaceBackups.restoredAt,
  }).from(workspaceBackups)
    .leftJoin(user, eq(workspaceBackups.createdBy, user.id))
    .orderBy(desc(workspaceBackups.createdAt))
    .limit(30);
}

export async function createWorkspaceBackup(actor: BackupActor, requestedLabel?: string) {
  return db.transaction(async (transaction) => {
    const snapshot = await readSnapshot(transaction);
    const label = requestedLabel?.trim() || `Backup ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())}`;
    const [backup] = await transaction.insert(workspaceBackups).values({
      label,
      schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      snapshot,
      summary: summarize(snapshot),
      createdBy: actor.id,
    }).returning();
    await transaction.insert(activityLogs).values({
      userId: actor.id,
      actorName: actor.name,
      actorInitials: actor.initials,
      action: "membuat backup data",
      details: label,
    });
    return backup;
  }, { isolationLevel: "repeatable read" });
}

export async function getWorkspaceBackupEnvelope(id: number): Promise<{ label: string; envelope: WorkspaceBackupEnvelope } | null> {
  const [backup] = await db.select().from(workspaceBackups).where(eq(workspaceBackups.id, id)).limit(1);
  if (!backup || backup.schemaVersion !== WORKSPACE_BACKUP_SCHEMA_VERSION || !isWorkspaceSnapshot(backup.snapshot)) return null;
  return {
    label: backup.label,
    envelope: {
      format: WORKSPACE_BACKUP_FORMAT,
      schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: backup.snapshot,
    },
  };
}

export async function restoreWorkspaceBackup(id: number, actor: BackupActor) {
  const [stored] = await db.select().from(workspaceBackups).where(eq(workspaceBackups.id, id)).limit(1);
  if (!stored || stored.schemaVersion !== WORKSPACE_BACKUP_SCHEMA_VERSION || !isWorkspaceSnapshot(stored.snapshot)) return { kind: "not-found" as const };
  const snapshot = stored.snapshot;

  return db.transaction(async (transaction) => {
    const requiredUserIds = new Set<string>();
    snapshot.projectMemberships.forEach((row) => requiredUserIds.add(row.userId));
    snapshot.projectComments.forEach((row) => requiredUserIds.add(row.authorId));
    snapshot.projectCompletionApprovals.forEach((row) => requiredUserIds.add(row.requestedBy));
    const existingUsers = await transaction.select({ id: user.id }).from(user);
    const existingUserIds = new Set(existingUsers.map((row) => row.id));
    const missingUserIds = Array.from(requiredUserIds).filter((userId) => !existingUserIds.has(userId));
    if (missingUserIds.length > 0) return { kind: "missing-users" as const, count: missingUserIds.length };

    const safetySnapshot = await readSnapshot(transaction);
    const [safetyBackup] = await transaction.insert(workspaceBackups).values({
      label: `Otomatis sebelum pemulihan #${id}`,
      schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      snapshot: safetySnapshot,
      summary: summarize(safetySnapshot),
      createdBy: actor.id,
    }).returning({ id: workspaceBackups.id });

    await transaction.delete(notifications);
    await transaction.delete(announcements);
    await transaction.delete(projectCommentMentions);
    await transaction.delete(projectComments);
    await transaction.delete(projectCompletionApprovals);
    await transaction.delete(projectMemberships);
    await transaction.delete(activityLogs);
    await transaction.delete(agendas);
    await transaction.delete(assets);
    await transaction.delete(projects);

    if (snapshot.projects.length) await transaction.insert(projects).values(snapshot.projects.map((row) => ({
      ...row,
      archivedAt: date(row.archivedAt),
      deadline: requiredDate(row.deadline),
      doneAt: date(row.doneAt),
      createdAt: requiredDate(row.createdAt),
      updatedAt: requiredDate(row.updatedAt),
      archivedBy: row.archivedBy && existingUserIds.has(row.archivedBy) ? row.archivedBy : null,
      primaryPicUserId: row.primaryPicUserId && existingUserIds.has(row.primaryPicUserId) ? row.primaryPicUserId : null,
    })));
    if (snapshot.projectMemberships.length) await transaction.insert(projectMemberships).values(snapshot.projectMemberships.map((row) => ({
      ...row,
      addedBy: row.addedBy && existingUserIds.has(row.addedBy) ? row.addedBy : null,
      createdAt: requiredDate(row.createdAt),
    })));
    if (snapshot.projectVersions?.length) await transaction.insert(projectVersions).values(snapshot.projectVersions.map((row) => ({
      ...row,
      createdBy: row.createdBy && existingUserIds.has(row.createdBy) ? row.createdBy : null,
      createdAt: requiredDate(row.createdAt),
    })));
    if (snapshot.projectComments.length) await transaction.insert(projectComments).values(snapshot.projectComments.map((row) => ({
      ...row,
      createdAt: requiredDate(row.createdAt),
      updatedAt: requiredDate(row.updatedAt),
    })));
    if (snapshot.projectCommentMentions.length) await transaction.insert(projectCommentMentions).values(snapshot.projectCommentMentions.map((row) => ({
      ...row,
      createdAt: requiredDate(row.createdAt),
    })));
    if (snapshot.projectCompletionApprovals.length) await transaction.insert(projectCompletionApprovals).values(snapshot.projectCompletionApprovals.map((row) => ({
      ...row,
      reviewedBy: row.reviewedBy && existingUserIds.has(row.reviewedBy) ? row.reviewedBy : null,
      requestedAt: requiredDate(row.requestedAt),
      reviewedAt: date(row.reviewedAt),
    })));
    if (snapshot.agendas.length) await transaction.insert(agendas).values(snapshot.agendas.map((row) => ({
      ...row,
      startTime: requiredDate(row.startTime),
      endTime: requiredDate(row.endTime),
      createdAt: requiredDate(row.createdAt),
      updatedAt: requiredDate(row.updatedAt),
    })));
    if (snapshot.assets.length) await transaction.insert(assets).values(snapshot.assets.map((row) => ({
      ...row,
      completedDate: requiredDate(row.completedDate),
      createdAt: requiredDate(row.createdAt),
      updatedAt: requiredDate(row.updatedAt),
    })));
    if (snapshot.activityLogs.length) await transaction.insert(activityLogs).values(snapshot.activityLogs.map((row) => ({
      ...row,
      userId: row.userId && existingUserIds.has(row.userId) ? row.userId : null,
      createdAt: requiredDate(row.createdAt),
    })));
    if (snapshot.announcements?.length) await transaction.insert(announcements).values(snapshot.announcements.map((row) => ({
      ...row,
      createdBy: row.createdBy && existingUserIds.has(row.createdBy) ? row.createdBy : null,
      startsAt: requiredDate(row.startsAt),
      endsAt: date(row.endsAt),
      createdAt: requiredDate(row.createdAt),
      updatedAt: requiredDate(row.updatedAt),
    })));

    await transaction.execute(sql`select setval(pg_get_serial_sequence('projects', 'id'), coalesce((select max(id) from projects), 1), exists(select 1 from projects))`);
    await transaction.execute(sql`select setval(pg_get_serial_sequence('project_comments', 'id'), coalesce((select max(id) from project_comments), 1), exists(select 1 from project_comments))`);
    await transaction.execute(sql`select setval(pg_get_serial_sequence('project_completion_approvals', 'id'), coalesce((select max(id) from project_completion_approvals), 1), exists(select 1 from project_completion_approvals))`);
    await transaction.execute(sql`select setval(pg_get_serial_sequence('agendas', 'id'), coalesce((select max(id) from agendas), 1), exists(select 1 from agendas))`);
    await transaction.execute(sql`select setval(pg_get_serial_sequence('assets', 'id'), coalesce((select max(id) from assets), 1), exists(select 1 from assets))`);
    await transaction.execute(sql`select setval(pg_get_serial_sequence('activity_logs', 'id'), coalesce((select max(id) from activity_logs), 1), exists(select 1 from activity_logs))`);
    await transaction.execute(sql`select setval(pg_get_serial_sequence('announcements', 'id'), coalesce((select max(id) from announcements), 1), exists(select 1 from announcements))`);
    await transaction.execute(sql`select setval(pg_get_serial_sequence('project_versions', 'id'), coalesce((select max(id) from project_versions), 1), exists(select 1 from project_versions))`);

    await transaction.insert(activityLogs).values({
      userId: actor.id,
      actorName: actor.name,
      actorInitials: actor.initials,
      action: "memulihkan backup data",
      details: `${stored.label} · safety backup #${safetyBackup.id}`,
    });
    await transaction.update(workspaceBackups).set({ restoredAt: new Date(), restoredBy: actor.id }).where(eq(workspaceBackups.id, id));
    return { kind: "restored" as const, safetyBackupId: safetyBackup.id };
  }, { isolationLevel: "serializable" });
}
