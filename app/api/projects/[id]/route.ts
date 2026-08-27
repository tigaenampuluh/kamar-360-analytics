import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { badRequest, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { deleteProject, findProjectById, updateProjectWithActivity } from "@/lib/services/project-service";
import { updateProjectSchema } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function parseProjectId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseProjectId((await params).id);
  if (!id) return badRequest("Invalid project id");
  const project = await findProjectById(id);
  return project ? Response.json({ data: project }) : notFound("Project");
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseProjectId((await params).id);
  if (!id) return badRequest("Invalid project id");
  const current = await findProjectById(id);
  if (!current) return notFound("Project");
  const parsed = updateProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid project data", parsed.error.flatten());

  const input = parsed.data;
  const update = {
    ...input,
    ...(input.pic ? { picInitials: input.picInitials || initials(input.pic) } : {}),
    ...(input.workingDocLink !== undefined ? { workingDocLink: input.workingDocLink || null } : {}),
  };
  const project = await updateProjectWithActivity(id, update, {
    userId: session.user.id,
    name: session.user.name,
    initials: initials(session.user.name),
  });
  if (!project) return notFound("Project");
  return Response.json({ data: project });
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseProjectId((await params).id);
  if (!id) return badRequest("Invalid project id");
  const project = await findProjectById(id);
  if (!project) return notFound("Project");
  await deleteProject(id);
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), action: "menghapus project", details: project.title });
  return new Response(null, { status: 204 });
}
