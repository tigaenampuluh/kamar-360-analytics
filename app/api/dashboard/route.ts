import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, agendas, projects } from "@/db/schema";
import { getApiSession, unauthorized } from "@/lib/api";
import { isAdminEmail } from "@/lib/admin";
import { memberActivityLabel, memberProjectMilestoneCondition, workActivityCondition } from "@/lib/activity-filter";
import type { ProjectStatus } from "@/lib/models/project";

export const runtime = "nodejs";

const dashboardStatuses: ProjectStatus[] = ["On Going", "Pending", "Delay", "Revisi", "Done"];

function createWorkStatistics(rows: Array<{ status: ProjectStatus; count: number }>) {
  const counts = Object.fromEntries(dashboardStatuses.map((status) => [status, 0])) as Record<ProjectStatus, number>;
  for (const row of rows) counts[row.status] = Number(row.count);

  return {
    total: dashboardStatuses.reduce((total, status) => total + counts[status], 0),
    byStatus: counts,
  };
}

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const detailedActivity = isAdminEmail(session.user.email);
  const now = new Date();
  const reminderWindowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const statusRows = await db.select({ status: projects.status, count: sql<number>`count(*)::int` }).from(projects).groupBy(projects.status);
  const statistics = createWorkStatistics(statusRows);
  const attention = await db.select().from(projects).where(inArray(projects.status, ["Delay", "Revisi"])).orderBy(asc(projects.deadline)).limit(5);
  const upcomingAgendas = await db.select().from(agendas).where(and(gte(agendas.startTime, now), lte(agendas.startTime, reminderWindowEnd))).orderBy(asc(agendas.startTime)).limit(5);
  const upcomingDeadlines = await db.select().from(projects).where(and(gte(projects.deadline, now), lte(projects.deadline, reminderWindowEnd), ne(projects.status, "Done"))).orderBy(asc(projects.deadline)).limit(5);
  const recentActivity = await db.select({
    id: activityLogs.id,
    userId: activityLogs.userId,
    actorName: activityLogs.actorName,
    actorInitials: activityLogs.actorInitials,
    projectId: activityLogs.projectId,
    projectTitle: projects.title,
    action: activityLogs.action,
    details: activityLogs.details,
    createdAt: activityLogs.createdAt,
  }).from(activityLogs).leftJoin(projects, eq(activityLogs.projectId, projects.id)).where(detailedActivity ? workActivityCondition() : memberProjectMilestoneCondition()).orderBy(desc(activityLogs.createdAt)).limit(5);
  const visibleActivity = detailedActivity ? recentActivity : recentActivity.map((row) => ({
    ...row,
    action: memberActivityLabel(row.action, row.details),
    projectTitle: row.projectTitle || row.details,
    details: "",
  }));
  const deadlineReminders = [
    ...upcomingDeadlines.map((project) => ({
      id: `project-${project.id}`,
      type: "Deadline" as const,
      title: project.title,
      at: project.deadline,
      pic: project.pic,
      projectId: project.id,
    })),
    ...upcomingAgendas.map((agenda) => ({
      id: `agenda-${agenda.id}`,
      type: "Agenda" as const,
      title: agenda.title,
      at: agenda.startTime,
      pic: agenda.pic,
      projectId: agenda.projectId,
    })),
  ].sort((first, second) => first.at.getTime() - second.at.getTime()).slice(0, 5);
  return Response.json({
    data: {
      statistics,
      total: statistics.total,
      completed: statistics.byStatus.Done,
      byStatus: dashboardStatuses.map((status) => ({ status, count: statistics.byStatus[status] })),
      attention,
      upcomingAgendas,
      upcomingDeadlines,
      deadlineReminders,
      recentActivity: visibleActivity,
    },
  });
}
