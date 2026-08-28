import { getApiSession, unauthorized } from "@/lib/api";
import { listWorkspaceMembers } from "@/lib/services/project-collaboration-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  return Response.json({ data: await listWorkspaceMembers() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
