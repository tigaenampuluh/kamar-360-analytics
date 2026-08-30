import { badRequest, forbidden, getApiSession, notFound, unauthorized } from "@/lib/api";
import { getProjectAccess } from "@/lib/services/project-collaboration-service";
import { findProjectById } from "@/lib/services/project-service";
import { listProjectVersions } from "@/lib/services/project-version-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const projectId = Number((await params).id);
  if (!Number.isInteger(projectId) || projectId < 1) return badRequest("Invalid project id");
  const project = await findProjectById(projectId);
  if (!project) return notFound("Project");
  const access = await getProjectAccess(projectId, session.user.id, session.user.email);
  if (!access.canEdit) return forbidden("Riwayat versi hanya dapat dilihat oleh Admin atau Lead project");
  return Response.json({ data: await listProjectVersions(projectId), canRestore: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
