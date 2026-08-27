import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, projects } from "@/db/schema";
import { badRequest, getApiSession, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const conditions: SQL[] = [];
  const userId = url.searchParams.get("userId");
  const projectId = url.searchParams.get("projectId");
  const search = url.searchParams.get("search")?.trim();
  if (userId) conditions.push(eq(activityLogs.userId, userId));
  if (projectId) {
    const parsedProjectId = Number(projectId);
    if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) return badRequest("Invalid project id");
    conditions.push(eq(activityLogs.projectId, parsedProjectId));
  }
  if (search) conditions.push(or(ilike(activityLogs.action, `%${search}%`), ilike(activityLogs.details, `%${search}%`), ilike(activityLogs.actorName, `%${search}%`))!);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return badRequest("Limit must be an integer between 1 and 100");
  const rows = await db.select({
    id: activityLogs.id,
    userId: activityLogs.userId,
    actorName: activityLogs.actorName,
    actorInitials: activityLogs.actorInitials,
    projectId: activityLogs.projectId,
    projectTitle: projects.title,
    action: activityLogs.action,
    details: activityLogs.details,
    createdAt: activityLogs.createdAt,
  }).from(activityLogs).leftJoin(projects, eq(activityLogs.projectId, projects.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(activityLogs.createdAt)).limit(limit);
  return Response.json({ data: rows });
}
