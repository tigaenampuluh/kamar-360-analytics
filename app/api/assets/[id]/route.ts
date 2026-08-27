import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, assets } from "@/db/schema";
import { badRequest, getApiSession, initials, notFound, unauthorized } from "@/lib/api";
import { updateAssetSchema } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function parseAssetId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseAssetId((await params).id);
  if (!id) return badRequest("Invalid asset id");
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return asset ? Response.json({ data: asset }) : notFound("Asset");
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseAssetId((await params).id);
  if (!id) return badRequest("Invalid asset id");
  const [current] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  if (!current) return notFound("Asset");
  const parsed = updateAssetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid asset data", parsed.error.flatten());
  const input = parsed.data;
  const changes = {
    ...input,
    ...(input.pic ? { picInitials: input.picInitials || initials(input.pic) } : {}),
    ...(input.assetLink !== undefined ? { assetLink: input.assetLink || null } : {}),
    ...(input.docLink !== undefined ? { docLink: input.docLink || null } : {}),
    updatedAt: new Date(),
  };
  const [asset] = await db.update(assets).set(changes).where(eq(assets.id, id)).returning();
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), projectId: asset.projectId, action: "memperbarui asset", details: asset.projectName });
  return Response.json({ data: asset });
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const id = parseAssetId((await params).id);
  if (!id) return badRequest("Invalid asset id");
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  if (!asset) return notFound("Asset");
  await db.delete(assets).where(eq(assets.id, id));
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), projectId: asset.projectId, action: "menghapus asset", details: asset.projectName });
  return new Response(null, { status: 204 });
}
