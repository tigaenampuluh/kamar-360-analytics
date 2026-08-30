import { getApiSession, unauthorized } from "@/lib/api";
import { listActiveAnnouncementsForUser } from "@/lib/services/announcement-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  return Response.json({ data: await listActiveAnnouncementsForUser(session.user.id) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
