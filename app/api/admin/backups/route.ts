import { z } from "zod";
import { forbidden, getApiSession, initials, unauthorized } from "@/lib/api";
import { isAdminEmail } from "@/lib/admin";
import { createWorkspaceBackup, listWorkspaceBackups } from "@/lib/services/workspace-backup-service";

export const runtime = "nodejs";

const createBackupSchema = z.object({
  label: z.string().trim().max(120).optional(),
});

async function requireAdmin(request: Request) {
  const session = await getApiSession(request);
  if (!session) return { response: unauthorized() } as const;
  if (!isAdminEmail(session.user.email)) return { response: forbidden("Hanya Admin yang dapat mengelola backup data") } as const;
  return { session } as const;
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  return Response.json({ data: await listWorkspaceBackups() });
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const parsed = createBackupSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Label backup tidak valid", details: parsed.error.flatten() }, { status: 400 });
  const backup = await createWorkspaceBackup({
    id: access.session.user.id,
    name: access.session.user.name,
    initials: initials(access.session.user.name),
  }, parsed.data.label);
  return Response.json({ data: backup }, { status: 201 });
}
