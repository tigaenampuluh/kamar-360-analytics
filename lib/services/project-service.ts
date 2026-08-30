import { and, asc, eq, gte, ilike, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, assets, projectMemberships, projects, projectVersions } from "@/db/schema";
import type { NewProjectRecord, ProjectChanges, ProjectFilters } from "@/lib/models/project";
import { getMembersForProjects, normalizeAssignments, type ProjectAssignment } from "@/lib/services/project-collaboration-service";
import { notifyProjectAssignments, notifyProjectCreated, notifyProjectUpdated } from "@/lib/services/notification-service";
import { buildProjectVersionSnapshot, describeProjectVersionChanges, trimProjectVersionHistory } from "@/lib/services/project-version-service";

export async function listProjects(filters: ProjectFilters = {}) {
  const conditions: SQL[] = [];
  const search = filters.search?.trim();
  conditions.push(filters.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt));

  if (search) {
    conditions.push(or(
      ilike(projects.title, `%${search}%`),
      ilike(projects.pic, `%${search}%`),
      ilike(projects.category, `%${search}%`),
    )!);
  }
  if (filters.status) conditions.push(eq(projects.status, filters.status));
  if (filters.pic) conditions.push(eq(projects.pic, filters.pic));
  if (filters.category) conditions.push(eq(projects.category, filters.category));
  if (filters.periodStart && filters.periodEnd) {
    const deadlinePeriod = and(gte(projects.deadline, filters.periodStart), lt(projects.deadline, filters.periodEnd))!;
    const donePeriod = and(gte(projects.doneAt, filters.periodStart), lt(projects.doneAt, filters.periodEnd))!;
    if (filters.status === "Done") conditions.push(donePeriod);
    else if (filters.status) conditions.push(deadlinePeriod);
    else conditions.push(or(
      and(ne(projects.status, "Done"), deadlinePeriod),
      and(eq(projects.status, "Done"), donePeriod),
    )!);
  }

  const rows = await db.select().from(projects)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(projects.deadline));
  const members = await getMembersForProjects(rows.map((project) => project.id));
  return rows.map((project) => ({ ...project, members: members.get(project.id) ?? [] }));
}

export async function findProjectById(id: number) {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return project ?? null;
}

export async function createProject(values: NewProjectRecord) {
  const [project] = await db.insert(projects).values({
    ...values,
    doneAt: values.status === "Done" ? values.doneAt ?? new Date() : values.doneAt,
  }).returning();
  return project;
}

type ActivityActor = {
  userId: string;
  name: string;
  initials: string;
};

export async function createProjectWithActivity(values: NewProjectRecord, actor: ActivityActor, assignments: ProjectAssignment[] = []) {
  const normalizedAssignments = normalizeAssignments(assignments, actor.userId, values.primaryPicUserId);
  const project = await db.transaction(async (transaction) => {
    const [project] = await transaction.insert(projects).values({
      ...values,
      doneAt: values.status === "Done" ? values.doneAt ?? new Date() : values.doneAt,
    }).returning();
    await transaction.insert(activityLogs).values({
      userId: actor.userId,
      actorName: actor.name,
      actorInitials: actor.initials,
      projectId: project.id,
      action: "membuat project",
      details: project.title,
    });
    await transaction.insert(projectMemberships).values(normalizedAssignments.map((assignment) => ({
      projectId: project.id,
      userId: assignment.userId,
      role: assignment.role,
      addedBy: actor.userId,
    })));
    const snapshot = buildProjectVersionSnapshot(project, normalizedAssignments);
    await transaction.insert(projectVersions).values({
      projectId: project.id,
      version: project.version,
      snapshot,
      changes: describeProjectVersionChanges(null, snapshot),
      action: "create",
      createdBy: actor.userId,
      createdByName: actor.name,
    });
    return project;
  });
  await Promise.all([
    notifyProjectCreated(project, actor.userId, actor.name),
    notifyProjectAssignments(project, actor.userId, actor.name, normalizedAssignments.map((assignment) => assignment.userId)),
  ]);
  const members = await getMembersForProjects([project.id]);
  await trimProjectVersionHistory(project.id);
  return { ...project, members: members.get(project.id) ?? [] };
}

export async function updateProjectWithActivity(id: number, changes: ProjectChanges, actor: ActivityActor, expectedVersion?: number, membershipAssignments?: ProjectAssignment[], historyAction: "update" | "restore" = "update") {
  const result = await db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!current) return { kind: "not-found" as const };
    if (expectedVersion !== undefined && expectedVersion !== current.version) {
      return { kind: "conflict" as const, current };
    }
    const previousAssignments = await transaction.select({ userId: projectMemberships.userId, role: projectMemberships.role })
      .from(projectMemberships)
      .where(eq(projectMemberships.projectId, id));

    const doneAtChange = historyAction === "restore"
      ? undefined
      : changes.status === "Done" && current.status !== "Done"
      ? new Date()
      : changes.status !== undefined && changes.status !== "Done" && current.status === "Done"
        ? null
        : undefined;
    const persistedChanges = doneAtChange === undefined ? changes : { ...changes, doneAt: doneAtChange };

    const [project] = await transaction.update(projects)
      .set({ ...persistedChanges, version: sql`${projects.version} + 1`, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.version, current.version)))
      .returning();
    if (!project) {
      const [latest] = await transaction.select().from(projects).where(eq(projects.id, id)).limit(1);
      return latest ? { kind: "conflict" as const, current: latest } : { kind: "not-found" as const };
    }

    const nextAssignments = membershipAssignments ?? previousAssignments;
    if (membershipAssignments) {
      await transaction.delete(projectMemberships).where(eq(projectMemberships.projectId, id));
      if (membershipAssignments.length > 0) {
        await transaction.insert(projectMemberships).values(membershipAssignments.map((assignment) => ({
          projectId: id,
          userId: assignment.userId,
          role: assignment.role,
          addedBy: actor.userId,
        })));
      }
    }

    const previousSnapshot = buildProjectVersionSnapshot(current, previousAssignments);
    const snapshot = buildProjectVersionSnapshot(project, nextAssignments);
    await transaction.insert(projectVersions).values({
      projectId: id,
      version: project.version,
      snapshot,
      changes: describeProjectVersionChanges(previousSnapshot, snapshot),
      action: historyAction,
      createdBy: actor.userId,
      createdByName: actor.name,
    });

    const statusChanged = changes.status !== undefined && changes.status !== current.status;
    await transaction.insert(activityLogs).values({
      userId: actor.userId,
      actorName: actor.name,
      actorInitials: actor.initials,
      projectId: id,
      action: historyAction === "restore" ? "memulihkan versi project" : statusChanged ? "memindahkan project" : "memperbarui project",
      details: historyAction === "restore" ? `Versi ${project.version}` : statusChanged ? `${current.status} → ${changes.status}` : project.title,
    });

    if (changes.status === "Done" && current.status !== "Done") {
      const [existingAsset] = await transaction.select({ id: assets.id }).from(assets).where(eq(assets.projectId, id)).limit(1);
      if (!existingAsset) {
        await transaction.insert(assets).values({
          projectId: id,
          projectName: project.title,
          category: project.category,
          pic: project.pic,
          picInitials: project.picInitials,
          completedDate: new Date(),
          description: project.description,
          docLink: project.workingDocLink,
          tags: [project.category.toLowerCase().replace(/\s+/g, "-")],
        });
      }
    }

    return {
      kind: "updated" as const,
      project,
      notificationDetail: historyAction === "restore" ? `memulihkan riwayat sebagai versi ${project.version}` : statusChanged ? `status ${current.status} menjadi ${changes.status}` : "informasi project diperbarui",
    };
  });
  if (result.kind !== "updated") return result;
  await Promise.all([
    notifyProjectUpdated(result.project, actor.userId, actor.name, result.notificationDetail),
    trimProjectVersionHistory(id),
  ]);
  return result;
}

export async function deleteProject(id: number, expectedVersion: number) {
  const [project] = await db.delete(projects).where(and(eq(projects.id, id), eq(projects.version, expectedVersion))).returning();
  return project ?? null;
}
