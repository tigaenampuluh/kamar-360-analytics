import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, agendas } from "@/db/schema";
import { badRequest, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { notifyAgendaChanged } from "@/lib/services/notification-service";
import { updateAgendaSchema } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function parseAgendaId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseAgendaId((await params).id);
  if (!id) return badRequest("Invalid agenda id");
  const [agenda] = await db.select().from(agendas).where(eq(agendas.id, id)).limit(1);
  return agenda ? Response.json({ data: agenda }) : notFound("Agenda");
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseAgendaId((await params).id);
  if (!id) return badRequest("Invalid agenda id");
  const [current] = await db.select().from(agendas).where(eq(agendas.id, id)).limit(1);
  if (!current) return notFound("Agenda");
  const parsed = updateAgendaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid agenda data", parsed.error.flatten());
  const nextStart = parsed.data.startTime ?? current.startTime;
  const nextEnd = parsed.data.endTime ?? current.endTime;
  if (nextEnd < nextStart) return badRequest("End time must be after start time");
  const [agenda] = await db.update(agendas).set({ ...parsed.data, updatedAt: new Date() }).where(eq(agendas.id, id)).returning();
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), projectId: agenda.projectId, action: "memperbarui agenda", details: agenda.title });
  await notifyAgendaChanged(agenda, session.user.id, session.user.name, "diperbarui");
  return Response.json({ data: agenda });
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseAgendaId((await params).id);
  if (!id) return badRequest("Invalid agenda id");
  const [agenda] = await db.select().from(agendas).where(eq(agendas.id, id)).limit(1);
  if (!agenda) return notFound("Agenda");
  await db.delete(agendas).where(eq(agendas.id, id));
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), projectId: agenda.projectId, action: "menghapus agenda", details: agenda.title });
  return new Response(null, { status: 204 });
}
