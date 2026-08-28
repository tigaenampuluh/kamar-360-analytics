import { z } from "zod";
import { badRequest, forbidden, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { isAdminEmail } from "@/lib/admin";
import { restoreWorkspaceBackup } from "@/lib/services/workspace-backup-service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const restoreSchema = z.object({ confirmation: z.literal("PULIHKAN") });

export async function POST(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  if (!isAdminEmail(session.user.email)) return forbidden("Hanya Admin yang dapat memulihkan backup data");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return notFound("Backup");
  const parsed = restoreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Ketik "PULIHKAN" untuk mengonfirmasi pemulihan data');
  const result = await restoreWorkspaceBackup(id, {
    id: session.user.id,
    name: session.user.name,
    initials: initials(session.user.name),
  });
  if (result.kind === "not-found") return notFound("Backup");
  if (result.kind === "missing-users") return Response.json({ error: `${result.count} akun anggota yang diperlukan backup sudah tidak tersedia. Pemulihan dibatalkan tanpa mengubah data.` }, { status: 409 });
  return Response.json({ data: result });
}
