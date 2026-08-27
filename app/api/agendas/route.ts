import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, agendas } from "@/db/schema";
import { badRequest, getApiSession, initials, unauthorized } from "@/lib/api";
import { notifyAgendaChanged } from "@/lib/services/notification-service";
import { createAgendaSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const conditions: SQL[] = [];
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const projectId = url.searchParams.get("projectId");
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const parsedProjectId = projectId ? Number(projectId) : null;
  if (fromDate && Number.isNaN(fromDate.getTime())) return badRequest("Invalid from date");
  if (toDate && Number.isNaN(toDate.getTime())) return badRequest("Invalid to date");
  if (fromDate && toDate && fromDate > toDate) return badRequest("Parameter from must not be after to");
  if (projectId && (!Number.isInteger(parsedProjectId) || parsedProjectId! <= 0)) return badRequest("Invalid project id");
  if (fromDate) conditions.push(gte(agendas.startTime, fromDate));
  if (toDate) conditions.push(lte(agendas.startTime, toDate));
  if (parsedProjectId) conditions.push(eq(agendas.projectId, parsedProjectId));
  const rows = await db.select().from(agendas).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(agendas.startTime));
  return Response.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const parsed = createAgendaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid agenda data", parsed.error.flatten());
  const [agenda] = await db.insert(agendas).values(parsed.data).returning();
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), projectId: agenda.projectId, action: "menambahkan agenda", details: agenda.title });
  await notifyAgendaChanged(agenda, session.user.id, session.user.name, "ditambahkan");
  return Response.json({ data: agenda }, { status: 201 });
}
