import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  projectCommentMentions,
  projectComments,
  projectCompletionApprovals,
  projectMemberships,
  projects,
  user,
} from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";

export type ProjectMemberRole = "Lead" | "Anggota" | "Viewer";
export type ProjectAssignment = { userId: string; role: ProjectMemberRole };

export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  workspaceRole: "Admin" | "Anggota";
};

export async function listWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const rows = await db.select({ id: user.id, name: user.name, email: user.email, username: user.username, image: user.image })
    .from(user)
    .orderBy(asc(user.name));
  return rows.map((member) => ({
    ...member,
    workspaceRole: isAdminEmail(member.email) ? "Admin" : "Anggota",
  }));
}

export async function findWorkspaceMember(userId: string) {
  const [member] = await db.select({ id: user.id, name: user.name, email: user.email, username: user.username, image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return member ?? null;
}

export function normalizeAssignments(assignments: ProjectAssignment[], actorUserId: string, primaryPicUserId?: string | null) {
  const byUser = new Map<string, ProjectMemberRole>();
  for (const assignment of assignments) byUser.set(assignment.userId, assignment.role);
  if (!byUser.has(actorUserId)) byUser.set(actorUserId, "Lead");
  if (primaryPicUserId) byUser.set(primaryPicUserId, "Lead");
  return Array.from(byUser, ([userId, role]) => ({ userId, role }));
}

export async function validateAssignments(assignments: ProjectAssignment[]) {
  const ids = Array.from(new Set(assignments.map((assignment) => assignment.userId)));
  if (ids.length === 0) return true;
  const rows = await db.select({ id: user.id }).from(user).where(inArray(user.id, ids));
  return rows.length === ids.length;
}

export async function syncProjectMembers(projectId: number, assignments: ProjectAssignment[], addedBy: string) {
  await db.transaction(async (transaction) => {
    await transaction.delete(projectMemberships).where(eq(projectMemberships.projectId, projectId));
    if (assignments.length > 0) {
      await transaction.insert(projectMemberships).values(assignments.map((assignment) => ({
        projectId,
        userId: assignment.userId,
        role: assignment.role,
        addedBy,
      })));
    }
  });
}

export async function getProjectMembers(projectId: number) {
  return db.select({
    userId: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    image: user.image,
    role: projectMemberships.role,
  }).from(projectMemberships)
    .innerJoin(user, eq(projectMemberships.userId, user.id))
    .where(eq(projectMemberships.projectId, projectId))
    .orderBy(asc(projectMemberships.role), asc(user.name));
}

export async function getMembersForProjects(projectIds: number[]) {
  if (projectIds.length === 0) return new Map<number, Awaited<ReturnType<typeof getProjectMembers>>>();
  const rows = await db.select({
    projectId: projectMemberships.projectId,
    userId: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    image: user.image,
    role: projectMemberships.role,
  }).from(projectMemberships)
    .innerJoin(user, eq(projectMemberships.userId, user.id))
    .where(inArray(projectMemberships.projectId, projectIds))
    .orderBy(asc(projectMemberships.role), asc(user.name));
  const grouped = new Map<number, typeof rows>();
  for (const member of rows) grouped.set(member.projectId, [...(grouped.get(member.projectId) ?? []), member]);
  return grouped;
}

export async function getProjectAccess(projectId: number, userId: string, email: string) {
  if (isAdminEmail(email)) {
    return {
      role: "Admin" as const,
      canEdit: true,
      canManageMembers: true,
      canComment: true,
      canRequestCompletion: true,
      canApproveCompletion: true,
      canDelete: true,
    };
  }
  const [membership] = await db.select({ role: projectMemberships.role })
    .from(projectMemberships)
    .where(and(eq(projectMemberships.projectId, projectId), eq(projectMemberships.userId, userId)))
    .limit(1);
  const role = membership?.role ?? null;
  return {
    role,
    canEdit: role === "Lead",
    canManageMembers: role === "Lead",
    canComment: role === "Lead" || role === "Anggota",
    canRequestCompletion: role === "Lead" || role === "Anggota",
    canApproveCompletion: role === "Lead",
    canDelete: role === "Lead",
  };
}

export async function getProjectComments(projectId: number) {
  const comments = await db.select({
    id: projectComments.id,
    body: projectComments.body,
    createdAt: projectComments.createdAt,
    updatedAt: projectComments.updatedAt,
    authorId: user.id,
    authorName: user.name,
    authorImage: user.image,
  }).from(projectComments)
    .innerJoin(user, eq(projectComments.authorId, user.id))
    .where(eq(projectComments.projectId, projectId))
    .orderBy(asc(projectComments.createdAt));
  if (comments.length === 0) return [];
  const mentions = await db.select({ commentId: projectCommentMentions.commentId, userId: projectCommentMentions.userId })
    .from(projectCommentMentions)
    .where(inArray(projectCommentMentions.commentId, comments.map((comment) => comment.id)));
  const byComment = new Map<number, string[]>();
  for (const mention of mentions) byComment.set(mention.commentId, [...(byComment.get(mention.commentId) ?? []), mention.userId]);
  return comments.map((comment) => ({ ...comment, mentionUserIds: byComment.get(comment.id) ?? [] }));
}

export async function getLatestCompletionApproval(projectId: number) {
  const [approval] = await db.select().from(projectCompletionApprovals)
    .where(eq(projectCompletionApprovals.projectId, projectId))
    .orderBy(desc(projectCompletionApprovals.requestedAt))
    .limit(1);
  if (!approval) return null;
  const relatedIds = [approval.requestedBy, approval.reviewedBy].filter((value): value is string => Boolean(value));
  const relatedUsers = relatedIds.length
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, relatedIds))
    : [];
  const names = new Map(relatedUsers.map((member) => [member.id, member.name]));
  return {
    ...approval,
    requestedByName: names.get(approval.requestedBy) ?? "Anggota",
    reviewedByName: approval.reviewedBy ? names.get(approval.reviewedBy) ?? "Reviewer" : null,
  };
}

export async function getProjectCollaboration(projectId: number, currentUser: { id: string; email: string }) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;
  const [members, comments, approval, permissions] = await Promise.all([
    getProjectMembers(projectId),
    getProjectComments(projectId),
    getLatestCompletionApproval(projectId),
    getProjectAccess(projectId, currentUser.id, currentUser.email),
  ]);
  return { project, members, comments, approval, permissions };
}
