import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { engagementContents } from "@/db/schema";
import {
  LATEST_CONTENT_LIMIT,
} from "@/lib/services/engagement-content-service";
import { aggregateContentTypeMetrics } from "@/lib/services/engagement-content-type-service";
import { getLatestPlatformContent } from "@/lib/services/engagement-platform-content-service";
import { normalizeEngagementProfileUrl } from "@/lib/services/engagement-profile-service";

export const runtime = "nodejs";
export const maxDuration = 60;

function invalidProfileResponse() {
  return Response.json({ error: "Gunakan parameter profileUrl berupa tautan profil publik Instagram, TikTok, atau YouTube." }, { status: 400 });
}

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("profileUrl")?.trim();
  if (!input || input.length > 2_048) return invalidProfileResponse();

  const profile = normalizeEngagementProfileUrl(input);
  if (!profile) return invalidProfileResponse();

  try {
    const rows = await db.select({
      contentType: engagementContents.contentType,
      engagementRate: engagementContents.engagementRate,
      views: engagementContents.views,
      likes: engagementContents.likes,
      comments: engagementContents.comments,
      shares: engagementContents.shares,
      unavailableFields: engagementContents.unavailableFields,
    })
      .from(engagementContents)
      .where(eq(engagementContents.profileUrl, profile.profileUrl))
      .orderBy(desc(engagementContents.publishedAt))
      .limit(LATEST_CONTENT_LIMIT);

    if (rows.length > 0) {
      return Response.json({
        data: {
          profile,
          count: rows.length,
          limit: LATEST_CONTENT_LIMIT,
          stats: aggregateContentTypeMetrics(rows),
          source: { mode: "database", status: "ready", message: null },
        },
      });
    }
  } catch {
    // Preview remains usable before the content migration or data sync is applied.
  }

  const live = await getLatestPlatformContent(profile);
  return Response.json({
    data: {
      profile,
      count: live.contents.length,
      limit: LATEST_CONTENT_LIMIT,
      stats: aggregateContentTypeMetrics(live.contents),
      source: live.source,
    },
  });
}
