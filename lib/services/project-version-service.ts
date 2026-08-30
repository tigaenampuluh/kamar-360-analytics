import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projectMemberships, projectVersions, type ProjectVersionSnapshot } from "@/db/schema";
import type { ProjectRecord } from "@/lib/models/project";
import type { ProjectAssignment } from "@/lib/services/project-collaboration-service";

const fieldLabels: Array<[keyof Omit<ProjectVersionSnapshot, "members">, string]> = [
  ["title", "Judul"],
  ["description", "Catatan"],
  ["pic", "PIC"],
  ["primaryPicUserId", "Akun PIC"],
  ["deadline", "Deadline"],
  ["doneAt", "Waktu selesai"],
  ["status", "Status"],
  ["priority", "Prioritas"],
  ["category", "Kategori"],
  ["workingDocLink", "Working document"],
  ["archivedAt", "Status arsip"],
];

export function buildProjectVersionSnapshot(project: ProjectRecord, members: ProjectAssignment[]): ProjectVersionSnapshot {
  return {
    title: project.title,
    description: project.description,
    pic: project.pic,
    picInitials: project.picInitials,
    primaryPicUserId: project.primaryPicUserId,
    deadline: project.deadline.toISOString(),
    doneAt: project.doneAt?.toISOString() ?? null,
    status: project.status,
    priority: project.priority,
    category: project.category,
    workingDocLink: project.workingDocLink,
    archivedAt: project.archivedAt?.toISOString() ?? null,
    members: [...members].sort((first, second) => first.userId.localeCompare(second.userId)),
  };
}

export function describeProjectVersionChanges(previous: ProjectVersionSnapshot | null, next: ProjectVersionSnapshot) {
  if (!previous) return ["Project dibuat"];
  const changes = fieldLabels.flatMap(([field, label]) => previous[field] !== next[field] ? [label] : []);
  if (JSON.stringify(previous.members) !== JSON.stringify(next.members)) changes.push("Anggota & role");
  return changes.length ? changes : ["Project diperbarui"];
}

export async function getProjectAssignments(projectId: number): Promise<ProjectAssignment[]> {
  return db.select({ userId: projectMemberships.userId, role: projectMemberships.role })
    .from(projectMemberships)
    .where(eq(projectMemberships.projectId, projectId));
}

export async function trimProjectVersionHistory(projectId: number) {
  await db.execute(sql`
    delete from ${projectVersions}
    where ${projectVersions.projectId} = ${projectId}
      and ${projectVersions.id} not in (
        select ${projectVersions.id}
        from ${projectVersions}
        where ${projectVersions.projectId} = ${projectId}
        order by ${projectVersions.version} desc
        limit 100
      )
  `);
}

export async function listProjectVersions(projectId: number) {
  return db.select().from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.version))
    .limit(100);
}
