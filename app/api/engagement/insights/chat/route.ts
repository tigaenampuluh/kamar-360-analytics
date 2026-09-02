import { z } from "zod";
import { getLatestPlatformContent } from "@/lib/services/engagement-platform-content-service";
import { answerEngagementQuestion, consumeInsightQuestion } from "@/lib/services/engagement-insights-service";
import { normalizeEngagementProfileUrl } from "@/lib/services/engagement-profile-service";
import { isEngagementInsightsEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const requestSchema = z.object({
  profileUrl: z.string().trim().max(2_048),
  question: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "profileUrl dan pertanyaan wajib diisi. Pertanyaan maksimal 500 karakter." }, { status: 400 });
  }

  const profile = normalizeEngagementProfileUrl(parsed.data.profileUrl);
  if (!profile) {
    return Response.json({ error: "Gunakan tautan profil publik Instagram, TikTok, atau YouTube." }, { status: 400 });
  }
  if (!isEngagementInsightsEnabled()) {
    return Response.json({ error: "Wawasan Cerdas sedang dinonaktifkan oleh feature flag.", code: "ENGAGEMENT_INSIGHTS_DISABLED" }, { status: 503 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const usage = consumeInsightQuestion(forwardedFor + ":" + profile.profileUrl);
  if (!usage.allowed) {
    return Response.json({
      error: "Batas pertanyaan sementara tercapai. Coba lagi setelah beberapa menit.",
      code: "INSIGHT_QUESTION_RATE_LIMITED",
      remainingQuestions: 0,
    }, {
      status: 429,
      headers: { "Retry-After": String(usage.retryAfterSeconds), "Cache-Control": "private, no-store" },
    });
  }

  const batch = await getLatestPlatformContent(profile);
  const answer = await answerEngagementQuestion(batch, parsed.data.question);
  return Response.json({
    data: {
      ...answer,
      remainingQuestions: usage.remaining,
      limit: 5,
      windowMinutes: 10,
    },
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
