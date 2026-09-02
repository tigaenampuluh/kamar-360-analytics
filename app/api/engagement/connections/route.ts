import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { engagementPlatformConnections } from "@/db/schema";
import { badRequest, getApiSession, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

const platforms = ["instagram", "tiktok", "youtube"] as const;
const platformSchema = z.enum(platforms);
const optionalDate = z.string().trim().max(64).nullable().optional().refine((value) => !value || !Number.isNaN(Date.parse(value)), "Tanggal harus berupa ISO date yang valid.");

const connectionSchema = z.object({
  platform: platformSchema,
  providerAccountId: z.string().trim().min(1).max(255),
  username: z.string().trim().min(2).max(50).nullable().optional(),
  profileUrl: z.union([z.url(), z.literal(""), z.null()]).optional(),
  accessToken: z.string().trim().min(1).max(8_192).nullable().optional(),
  refreshToken: z.string().trim().min(1).max(8_192).nullable().optional(),
  accessTokenExpiresAt: optionalDate,
  refreshTokenExpiresAt: optionalDate,
  scope: z.string().trim().max(2_048).nullable().optional(),
});

type Platform = (typeof platforms)[number];
type ConnectionStatus = "connected" | "expired" | "revoked" | "error" | "disconnected";

function serializeConnection(platform: Platform, connection?: typeof engagementPlatformConnections.$inferSelect) {
  const status: ConnectionStatus = connection?.status ?? "disconnected";
  return {
    platform,
    status,
    connected: status === "connected",
    providerAccountId: connection?.providerAccountId ?? null,
    username: connection?.username ?? null,
    profileUrl: connection?.profileUrl ?? null,
    scope: connection?.scope ?? null,
    accessTokenExpiresAt: connection?.accessTokenExpiresAt?.toISOString() ?? null,
    refreshTokenExpiresAt: connection?.refreshTokenExpiresAt?.toISOString() ?? null,
    lastConnectedAt: connection?.lastConnectedAt?.toISOString() ?? null,
    lastCheckedAt: connection?.lastCheckedAt?.toISOString() ?? null,
    lastError: connection?.lastError ?? null,
  };
}

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();

  const platformParam = new URL(request.url).searchParams.get("platform");
  const parsedPlatform = platformParam ? platformSchema.safeParse(platformParam) : null;
  if (platformParam && !parsedPlatform?.success) {
    return badRequest("Platform harus instagram, tiktok, atau youtube.");
  }

  try {
    const rows = await db.select().from(engagementPlatformConnections)
      .where(eq(engagementPlatformConnections.userId, session.user.id));
    const connectionsByPlatform = new Map(rows.map((connection) => [connection.platform, connection]));
    const requestedPlatforms = parsedPlatform?.success ? [parsedPlatform.data] : platforms;
    const data = requestedPlatforms.map((platform) => serializeConnection(platform, connectionsByPlatform.get(platform)));

    return Response.json({ data }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ error: "Status koneksi belum dapat dimuat. Pastikan migrasi database sudah diterapkan." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();

  const parsed = connectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Data koneksi platform tidak valid.", parsed.error.flatten());

  const input = parsed.data;
  const expiresAt = (value: string | null | undefined) => value ? new Date(value) : null;

  try {
    const [ownedByAnotherUser] = await db.select({ id: engagementPlatformConnections.id })
      .from(engagementPlatformConnections)
      .where(and(
        eq(engagementPlatformConnections.platform, input.platform),
        eq(engagementPlatformConnections.providerAccountId, input.providerAccountId),
        ne(engagementPlatformConnections.userId, session.user.id),
      ))
      .limit(1);
    if (ownedByAnotherUser) return Response.json({ error: "Akun platform tersebut sudah terhubung ke pengguna lain." }, { status: 409 });

    const now = new Date();
    const [connection] = await db.insert(engagementPlatformConnections).values({
      userId: session.user.id,
      platform: input.platform,
      providerAccountId: input.providerAccountId,
      username: input.username ?? null,
      profileUrl: input.profileUrl || null,
      accessToken: input.accessToken ?? null,
      refreshToken: input.refreshToken ?? null,
      accessTokenExpiresAt: expiresAt(input.accessTokenExpiresAt),
      refreshTokenExpiresAt: expiresAt(input.refreshTokenExpiresAt),
      scope: input.scope ?? null,
      status: "connected",
      lastConnectedAt: now,
      lastCheckedAt: now,
      lastError: null,
    }).onConflictDoUpdate({
      target: [engagementPlatformConnections.userId, engagementPlatformConnections.platform],
      set: {
        providerAccountId: input.providerAccountId,
        username: input.username ?? null,
        profileUrl: input.profileUrl || null,
        ...(input.accessToken !== undefined ? { accessToken: input.accessToken } : {}),
        ...(input.refreshToken !== undefined ? { refreshToken: input.refreshToken } : {}),
        ...(input.accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt: expiresAt(input.accessTokenExpiresAt) } : {}),
        ...(input.refreshTokenExpiresAt !== undefined ? { refreshTokenExpiresAt: expiresAt(input.refreshTokenExpiresAt) } : {}),
        ...(input.scope !== undefined ? { scope: input.scope ?? null } : {}),
        status: "connected",
        lastConnectedAt: now,
        lastCheckedAt: now,
        lastError: null,
        updatedAt: now,
      },
    }).returning();

    return connection ? Response.json({ data: serializeConnection(input.platform, connection) }) : Response.json({ error: "Koneksi platform gagal disimpan." }, { status: 500 });
  } catch {
    return Response.json({ error: "Koneksi platform belum dapat disimpan. Pastikan migrasi database sudah diterapkan." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();

  const platformParam = new URL(request.url).searchParams.get("platform");
  const parsedPlatform = platformSchema.safeParse(platformParam);
  if (!parsedPlatform.success) return badRequest("Parameter platform wajib berupa instagram, tiktok, atau youtube.");

  try {
    const [connection] = await db.update(engagementPlatformConnections).set({
      status: "revoked",
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      lastCheckedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    }).where(and(
      eq(engagementPlatformConnections.userId, session.user.id),
      eq(engagementPlatformConnections.platform, parsedPlatform.data),
    )).returning();

    return connection
      ? Response.json({ data: serializeConnection(parsedPlatform.data, connection) })
      : Response.json({ data: serializeConnection(parsedPlatform.data) });
  } catch {
    return Response.json({ error: "Koneksi platform belum dapat diputus. Pastikan migrasi database sudah diterapkan." }, { status: 503 });
  }
}
