import { badRequest, getApiSession, notFound, unauthorized } from "@/lib/api";
import { getProjectCollaboration } from "@/lib/services/project-collaboration-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return badRequest("Invalid project id");
  const detail = await getProjectCollaboration(id, { id: session.user.id, email: session.user.email });
  return detail ? Response.json({ data: detail }) : notFound("Project");
}
