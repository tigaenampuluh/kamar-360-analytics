import { z } from "zod";
import { calculateEngagementMetrics } from "@/lib/services/engagement-metrics-service";
import { getLatestPlatformContent } from "@/lib/services/engagement-platform-content-service";
import { normalizeEngagementProfileUrl } from "@/lib/services/engagement-profile-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  profileUrls: z.array(z.string().trim().max(2_048)).min(1).max(4),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "profileUrls wajib berisi 1 sampai 4 link profil." }, { status: 400 });
  }

  const profiles = parsed.data.profileUrls.map((profileUrl) => normalizeEngagementProfileUrl(profileUrl));
  if (profiles.some((profile) => profile === null)) {
    return Response.json({ error: "Gunakan link profil publik Instagram, TikTok, atau YouTube yang valid." }, { status: 400 });
  }

  const normalizedProfiles = profiles as NonNullable<typeof profiles[number]>[];
  const accounts = await Promise.all(normalizedProfiles.map(async (profile) => {
    const batch = await getLatestPlatformContent(profile);
    const metrics = calculateEngagementMetrics(batch.contents);
    const sourceLabel = batch.source.mode === "apify"
      ? "Apify"
      : batch.source.mode === "public" || batch.source.mode === "partial"
        ? "Data publik"
        : "Data tiruan";
    return {
      profileUrl: profile.profileUrl,
      platform: profile.platform,
      username: profile.username,
      followersCount: batch.followersCount,
      erAverage: metrics.summary.erAverage,
      erWeighted: metrics.summary.erWeighted,
      totalInteractions: metrics.totalInteractions,
      source: batch.source.mode,
      sourceLabel,
      sourceMessage: batch.source.message || "Sumber data tidak memiliki catatan tambahan.",
      fetchedTitle: null,
    };
  }));
  return Response.json({ data: { accounts, source: "public_fetch", message: "Aplikasi mengambil data publik tanpa koneksi akun." } });
}
