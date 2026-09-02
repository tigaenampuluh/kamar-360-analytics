import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { engagementAnalysisHistory } from "@/db/schema";
import { getApiSession } from "@/lib/api";
import { normalizeEngagementProfileUrl } from "@/lib/services/engagement-profile-service";

export const runtime = "nodejs";

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 50;
const MAX_DATABASE_INTEGER = 2_147_483_647;
const nonNegativeInteger = z.number().int().min(0).max(MAX_DATABASE_INTEGER);

const contentSchema = z.object({
  views: nonNegativeInteger,
  likes: nonNegativeInteger,
  comments: nonNegativeInteger,
  shares: nonNegativeInteger.nullable().optional(),
  unavailableFields: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
});

const saveHistorySchema = z.object({
  profileUrl: z.string().trim().max(2_048).optional(),
  account: z.object({
    platform: z.enum(["instagram", "tiktok", "youtube"]),
    username: z.string().trim().min(2).max(50),
    profileUrl: z.string().trim().max(2_048).optional(),
    followersCount: nonNegativeInteger,
    totalInteractions: nonNegativeInteger,
  }),
  summary: z.object({
    erAverage: z.number().nonnegative().max(100),
    erMedian: z.number().nonnegative().max(100),
    erWeighted: z.number().nonnegative().max(100),
  }),
  contents: z.array(contentSchema).max(20).default([]),
  followersChangePercent: z.number().min(-100).max(1_000).optional().default(0),
  source: z.object({ mode: z.string().trim().min(1).max(32).optional() }).optional(),
}).refine((value) => Boolean(value.profileUrl || value.account.profileUrl), {
  message: "profileUrl wajib diisi.",
  path: ["profileUrl"],
});

function parseHistoryProfile(profileUrl: string, platform: string, username: string) {
  const profile = normalizeEngagementProfileUrl(profileUrl);
  if (!profile || profile.platform !== platform || profile.username.toLowerCase() !== username.toLowerCase()) return null;
  return profile;
}

function parseHistoryLimit(rawLimit: string | null) {
  if (rawLimit === null) return DEFAULT_HISTORY_LIMIT;
  const limit = Number(rawLimit);
  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_HISTORY_LIMIT ? limit : null;
}

export async function POST(request: Request) {
  const session = await getApiSession(request);
  const body = await request.json().catch(() => null);
  const parsed = saveHistorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Payload hasil analisis tidak lengkap atau tidak valid.", details: parsed.error.flatten() }, { status: 400 });
  }

  const inputProfileUrl = parsed.data.profileUrl || parsed.data.account.profileUrl || "";
  const profile = parseHistoryProfile(inputProfileUrl, parsed.data.account.platform, parsed.data.account.username);
  const accountProfile = parsed.data.account.profileUrl ? normalizeEngagementProfileUrl(parsed.data.account.profileUrl) : profile;
  if (!profile || !accountProfile || accountProfile.profileUrl !== profile.profileUrl) {
    return Response.json({ error: "Profil pada hasil analisis tidak valid atau platform-nya tidak cocok." }, { status: 400 });
  }

  const totalInteractions = parsed.data.contents.reduce((total, content) => total + content.likes + content.comments + (content.shares ?? 0), 0);
  const totalViews = parsed.data.contents.reduce((total, content) => total + content.views, 0);
  const unavailableFields = [...new Set(parsed.data.contents.flatMap((content) => content.unavailableFields))];

  try {
    const [saved] = await db.insert(engagementAnalysisHistory).values({
      userId: session?.user.id ?? null,
      platform: profile.platform,
      profileUrl: profile.profileUrl,
      username: profile.username,
      followersCount: parsed.data.account.followersCount,
      followersChangePercent: parsed.data.followersChangePercent,
      contentCount: parsed.data.contents.length,
      erAverage: parsed.data.summary.erAverage,
      erMedian: parsed.data.summary.erMedian,
      erWeighted: parsed.data.summary.erWeighted,
      totalInteractions,
      totalViews,
      unavailableFields,
      source: parsed.data.source?.mode || "mock",
    }).returning({ id: engagementAnalysisHistory.id, analyzedAt: engagementAnalysisHistory.analyzedAt });

    return Response.json({
      data: {
        id: saved.id,
        profile,
        contentCount: parsed.data.contents.length,
        analyzedAt: saved.analyzedAt.toISOString(),
        source: "database",
      },
    }, { status: 201 });
  } catch {
    return Response.json({ error: "Riwayat belum dapat disimpan. Pastikan migrasi database sudah diterapkan." }, { status: 503 });
  }
}

function mapHistoryRow(row: typeof engagementAnalysisHistory.$inferSelect) {
  return {
    id: String(row.id),
    profile: {
      platform: row.platform,
      username: row.username,
      profileUrl: row.profileUrl,
    },
    followersCount: row.followersCount,
    followersChangePercent: row.followersChangePercent,
    contentCount: row.contentCount,
    summary: {
      erAverage: row.erAverage,
      erMedian: row.erMedian,
      erWeighted: row.erWeighted,
    },
    totalInteractions: row.totalInteractions,
    totalViews: row.totalViews,
    unavailableFields: row.unavailableFields,
    source: row.source,
    analyzedAt: row.analyzedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const session = await getApiSession(request);
  const searchParams = new URL(request.url).searchParams;
  const input = searchParams.get("profileUrl")?.trim();
  if (!input || input.length > 2_048) {
    return Response.json({ error: "Gunakan parameter profileUrl berupa tautan profil publik Instagram, TikTok, atau YouTube." }, { status: 400 });
  }

  const rawLimit = searchParams.get("limit");
  const limit = parseHistoryLimit(rawLimit);
  if (limit === null) {
    return Response.json({ error: `limit harus berupa angka bulat antara 1 dan ${MAX_HISTORY_LIMIT}.` }, { status: 400 });
  }

  const profile = normalizeEngagementProfileUrl(input);
  if (!profile) {
    return Response.json({ error: "Gunakan parameter profileUrl berupa tautan profil publik Instagram, TikTok, atau YouTube." }, { status: 400 });
  }

  try {
    const rows = await db.select().from(engagementAnalysisHistory)
      .where(and(
        eq(engagementAnalysisHistory.profileUrl, profile.profileUrl),
        session ? eq(engagementAnalysisHistory.userId, session.user.id) : isNull(engagementAnalysisHistory.userId),
      ))
      .orderBy(desc(engagementAnalysisHistory.analyzedAt))
      .limit(limit);

    return Response.json({
      data: {
        profile,
        count: rows.length,
        limit,
        history: rows.map(mapHistoryRow),
        source: { mode: "database", status: "ready", message: null },
      },
    });
  } catch {
    return Response.json({ error: "Riwayat belum dapat diambil. Pastikan migrasi database sudah diterapkan." }, { status: 503 });
  }
}
