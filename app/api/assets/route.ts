import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, assets } from "@/db/schema";
import { badRequest, getApiSession, initials, unauthorized } from "@/lib/api";
import { createAssetSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const conditions: SQL[] = [];
  const search = url.searchParams.get("search")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const pic = url.searchParams.get("pic")?.trim();
  const tag = url.searchParams.get("tag")?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(
      ilike(assets.projectName, pattern),
      ilike(assets.description, pattern),
      ilike(assets.category, pattern),
      ilike(assets.pic, pattern),
      sql<boolean>`${assets.tags}::text ILIKE ${pattern}`,
    )!);
  }
  if (category) conditions.push(eq(assets.category, category));
  if (pic) conditions.push(eq(assets.pic, pic));
  if (tag) conditions.push(sql<boolean>`${assets.tags} @> ${JSON.stringify([tag])}::jsonb`);
  const rows = await db.select().from(assets).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(assets.completedDate));
  return Response.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const parsed = createAssetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid asset data", parsed.error.flatten());
  const input = parsed.data;
  const [asset] = await db.insert(assets).values({ ...input, picInitials: input.picInitials || initials(input.pic), assetLink: input.assetLink || null, docLink: input.docLink || null }).returning();
  await db.insert(activityLogs).values({ userId: session.user.id, actorName: session.user.name, actorInitials: initials(session.user.name), projectId: asset.projectId, action: "menambahkan asset", details: asset.projectName });
  return Response.json({ data: asset }, { status: 201 });
}
