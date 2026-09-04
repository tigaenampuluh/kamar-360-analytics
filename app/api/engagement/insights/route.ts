import { z } from "zod";
import { getLatestPlatformContent } from "@/lib/services/engagement-platform-content-service";
import { buildEngagementInsights } from "@/lib/services/engagement-insights-service";
import { normalizeEngagementProfileUrl } from "@/lib/services/engagement-profile-service";
import { isEngagementInsightsEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const maxDuration = 60;

const profileUrlSchema = z.string().trim().min(1).max(2_048);

function invalidProfileResponse() {
  return Response.json({ error: "Gunakan parameter profileUrl berupa tautan profil publik Instagram, TikTok, atau YouTube." }, { status: 400 });
}

export async function GET(request: Request) {
  const rawProfileUrl = new URL(request.url).searchParams.get("profileUrl");
  const parsedUrl = profileUrlSchema.safeParse(rawProfileUrl);
  if (!parsedUrl.success) return invalidProfileResponse();

  const profile = normalizeEngagementProfileUrl(parsedUrl.data);
  if (!profile) return invalidProfileResponse();
  if (!isEngagementInsightsEnabled()) {
    return Response.json({
      error: "Wawasan Cerdas sedang dinonaktifkan oleh feature flag.",
      code: "ENGAGEMENT_INSIGHTS_DISABLED",
    }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store", "Retry-After": "3600" },
    });
  }

  const batch = await getLatestPlatformContent(profile);
  return Response.json({ data: await buildEngagementInsights(batch) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
