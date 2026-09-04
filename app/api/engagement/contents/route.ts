import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { engagementContents } from "@/db/schema";
import { LATEST_CONTENT_LIMIT } from "@/lib/services/engagement-content-service";
import { getLatestPlatformContent } from "@/lib/services/engagement-platform-content-service";
import { normalizeEngagementProfileUrl } from "@/lib/services/engagement-profile-service";

export const runtime = "nodejs";
export const maxDuration = 60;

function invalidProfileResponse() {
  return Response.json({ error: "Gunakan parameter profileUrl berupa tautan profil publik Instagram, TikTok, atau YouTube." }, { status: 400 });
}

function mapStoredContent(row: typeof engagementContents.$inferSelect) {
  return {
    id: String(row.id),
    platform: row.platform,
    username: row.username,
    contentType: row.contentType,
    title: row.title,
    caption: row.title,
    externalId: row.externalId,
    url: row.url,
    thumbnailUrl: null,
    publishedAt: row.publishedAt.toISOString(),
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    engagementRate: row.engagementRate,
    isBest: row.isBest,
    unavailableFields: row.unavailableFields,
  };
}

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("profileUrl")?.trim();
  if (!input || input.length > 2_048) return invalidProfileResponse();

  const profile = normalizeEngagementProfileUrl(input);
  if (!profile) return invalidProfileResponse();

  try {
    const rows = await db.select().from(engagementContents)
      .where(eq(engagementContents.profileUrl, profile.profileUrl))
      .orderBy(desc(engagementContents.publishedAt))
      .limit(LATEST_CONTENT_LIMIT);

    if (rows.length > 0) {
      return Response.json({
        data: {
          profile,
          count: rows.length,
          limit: LATEST_CONTENT_LIMIT,
          contents: rows.map(mapStoredContent),
          source: { mode: "database", status: "ready", message: null },
        },
      });
    }
  } catch {
    // The preview adapter below keeps the endpoint usable before migration/data sync.
  }

  const live = await getLatestPlatformContent(profile);
  return Response.json({
    data: {
      profile,
      count: live.contents.length,
      limit: LATEST_CONTENT_LIMIT,
      contents: live.contents,
      source: live.source,
    },
  });
}
