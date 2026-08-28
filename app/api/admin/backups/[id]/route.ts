import { forbidden, getApiSession, notFound, unauthorized } from "@/lib/api";
import { isAdminEmail } from "@/lib/admin";
import { getWorkspaceBackupEnvelope } from "@/lib/services/workspace-backup-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  if (!isAdminEmail(session.user.email)) return forbidden("Hanya Admin yang dapat mengunduh backup data");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return notFound("Backup");
  const result = await getWorkspaceBackupEnvelope(id);
  if (!result) return notFound("Backup");
  const safeLabel = result.label.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || `backup-${id}`;
  return new Response(JSON.stringify(result.envelope, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="360-${safeLabel}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
