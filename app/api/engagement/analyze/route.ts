import { z } from "zod";
import { type EngagementContent, type EngagementPlatform, type EngagementProfile } from "@/lib/services/engagement-content-service";
import { calculateEngagementMetrics } from "@/lib/services/engagement-metrics-service";
import { getLatestPlatformContent } from "@/lib/services/engagement-platform-content-service";
import { normalizeEngagementProfileUrl } from "@/lib/services/engagement-profile-service";

export const runtime = "nodejs";
export const maxDuration = 60;

type Platform = EngagementPlatform;
type Profile = EngagementProfile;
type AvailabilityStatus = "available" | "partial" | "unavailable";
type MetricField = "views" | "likes" | "comments" | "shares";

const requestSchema = z.object({
  profileUrl: z.string().trim().max(2_048).optional(),
  url: z.string().trim().max(2_048).optional(),
}).refine((value) => Boolean(value.profileUrl || value.url), {
  message: "profileUrl wajib diisi.",
  path: ["profileUrl"],
});

function metricAvailability(contents: readonly EngagementContent[], field: MetricField): AvailabilityStatus {
  if (contents.length === 0) return "unavailable";
  const unavailableCount = contents.filter((content) => content[field] === null || content.unavailableFields.includes(field)).length;
  if (unavailableCount === contents.length) return "unavailable";
  return unavailableCount > 0 ? "partial" : "available";
}

function buildDataAvailability(followersCount: number, contents: readonly EngagementContent[]) {
  const dataAvailability = {
    audience: (followersCount > 0 ? "available" : "unavailable") as AvailabilityStatus,
    views: metricAvailability(contents, "views"),
    likes: metricAvailability(contents, "likes"),
    comments: metricAvailability(contents, "comments"),
    shares: metricAvailability(contents, "shares"),
  };
  const unavailableFields = Object.entries(dataAvailability)
    .filter(([, status]) => status !== "available")
    .map(([field]) => field);
  const partialFields = Object.entries(dataAvailability)
    .filter(([, status]) => status === "partial")
    .map(([field]) => field);

  return {
    ...dataAvailability,
    unavailableFields,
    message: unavailableFields.length > 0
      ? `${partialFields.length > 0 ? "Sebagian" : "Data"} metrik tidak tersedia: ${unavailableFields.join(", ")}.`
      : null,
  };
}

async function createAnalysis(profile: Profile) {
  const batch = await getLatestPlatformContent(profile);
  const { contents, followersCount } = batch;
  const { summary, totalInteractions } = calculateEngagementMetrics(contents);

  return {
    account: {
      platform: profile.platform,
      username: profile.username,
      profileUrl: profile.profileUrl,
      followersCount,
      totalInteractions,
    },
    summary,
    contents,
    dataAvailability: buildDataAvailability(followersCount, contents),
    source: batch.source,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Tautan profil wajib diisi dan harus berupa URL yang valid.", details: parsed.error.flatten() }, { status: 400 });
  }

  const profile = normalizeEngagementProfileUrl(parsed.data.profileUrl || parsed.data.url || "");
  if (!profile) {
    return Response.json({ error: "Gunakan tautan profil publik Instagram, TikTok, atau YouTube." }, { status: 400 });
  }

  return Response.json({ data: await createAnalysis(profile) });
}
