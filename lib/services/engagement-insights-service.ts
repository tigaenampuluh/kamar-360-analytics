import type { EngagementContent, EngagementProfile } from "@/lib/services/engagement-content-service";
import { aggregateContentTypeMetrics } from "@/lib/services/engagement-content-type-service";
import { calculateEngagementMetrics } from "@/lib/services/engagement-metrics-service";
import type { PlatformContentSource } from "@/lib/services/engagement-platform-content-service";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function contentTypeLabel(contentType: EngagementContent["contentType"] | undefined) {
  if (contentType === "reels") return "Reels";
  if (contentType === "carousel") return "Carousel";
  if (contentType === "photo") return "Foto";
  if (contentType === "shorts") return "Shorts";
  return "Video";
}

export type EngagementInsightsInput = {
  profile: EngagementProfile;
  followersCount: number;
  contents: readonly EngagementContent[];
  source: PlatformContentSource;
};

export type ContentRecommendation = {
  title: string;
  description: string;
  priority: string;
  signal: string;
};

type VikeyInsightData = {
  summary: Array<{
    title: string;
    description: string;
    metric: string;
    label: string;
  }>;
  recommendations: ContentRecommendation[];
};

type VikeyChatMessage = {
  role: "system" | "user";
  content: string;
};

const insightQuestionLimit = 5;
const insightQuestionWindowMs = 10 * 60 * 1_000;
const insightQuestionUsage = new Map<string, { count: number; resetAt: number }>();

export function consumeInsightQuestion(key: string, now = Date.now()) {
  const current = insightQuestionUsage.get(key);
  if (!current || now >= current.resetAt) {
    insightQuestionUsage.set(key, { count: 1, resetAt: now + insightQuestionWindowMs });
    return { allowed: true, remaining: insightQuestionLimit - 1, retryAfterSeconds: 0 };
  }
  if (current.count >= insightQuestionLimit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
  }
  current.count += 1;
  return { allowed: true, remaining: insightQuestionLimit - current.count, retryAfterSeconds: 0 };
}

function readAiText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : null;
}

function readVikeyMessageContent(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("choices" in payload) || !Array.isArray(payload.choices)) return null;
  const choice = payload.choices[0];
  if (!choice || typeof choice !== "object" || !("message" in choice) || !choice.message || typeof choice.message !== "object") return null;
  const content = (choice.message as { content?: unknown }).content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

async function requestVikeyChat(messages: VikeyChatMessage[], maxTokens: number) {
  const apiKey = process.env.VIKEY_API_KEY?.trim();
  const model = process.env.VIKEY_MODEL?.trim() || "openai/gpt-5.6-luna";
  if (!apiKey) return null;

  const baseUrl = (process.env.VIKEY_BASE_URL?.trim() || "https://api.vikey.ai/v1").replace(new RegExp("/+$"), "");
  try {
    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: maxTokens, messages }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return readVikeyMessageContent(await response.json().catch(() => null));
  } catch {
    return null;
  }
}

function parseVikeyInsightData(payload: unknown): VikeyInsightData | null {
  if (!payload || typeof payload !== "object" || !("choices" in payload) || !Array.isArray(payload.choices)) return null;
  const choice = payload.choices[0];
  if (!choice || typeof choice !== "object" || !("message" in choice) || !choice.message || typeof choice.message !== "object") return null;
  const rawContent = (choice.message as { content?: unknown }).content;
  if (typeof rawContent !== "string") return null;
  const jsonStart = rawContent.indexOf("{");
  const jsonEnd = rawContent.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent.slice(jsonStart, jsonEnd + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as { summary?: unknown; recommendations?: unknown };
  if (!Array.isArray(value.summary) || !Array.isArray(value.recommendations)) return null;

  const summary = value.summary.slice(0, 3).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const insight = item as Record<string, unknown>;
    const title = readAiText(insight.title);
    const description = readAiText(insight.description);
    const metric = readAiText(insight.metric);
    const label = readAiText(insight.label);
    return title && description && metric && label ? [{ title, description, metric, label }] : [];
  });
  const recommendations = value.recommendations.slice(0, 3).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const recommendation = item as Record<string, unknown>;
    const title = readAiText(recommendation.title);
    const description = readAiText(recommendation.description);
    const priority = readAiText(recommendation.priority);
    const signal = readAiText(recommendation.signal);
    return title && description && priority && signal ? [{ title, description, priority, signal }] : [];
  });

  return summary.length > 0 && recommendations.length > 0 ? { summary, recommendations } : null;
}

async function generateVikeyInsights(input: {
  profile: EngagementProfile;
  followersCount: number;
  contents: readonly EngagementContent[];
  metrics: ReturnType<typeof calculateEngagementMetrics>;
  typeStats: ReturnType<typeof aggregateContentTypeMetrics>;
}) {
  const apiKey = process.env.VIKEY_API_KEY?.trim();
  const model = process.env.VIKEY_MODEL?.trim() || "openai/gpt-5.6-luna";
  if (!apiKey || !model) return null;

  const baseUrl = (process.env.VIKEY_BASE_URL?.trim() || "https://api.vikey.ai/v1").replace(new RegExp("/+$"), "");
  const response = await fetch(baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: "Kamu adalah analis engagement berbahasa Indonesia. Gunakan hanya data yang diberikan, jangan mengarang angka atau fakta. Balas JSON valid tanpa markdown dengan struktur {summary:[{title,description,metric,label}],recommendations:[{title,description,priority,signal}]}. Maksimal 3 item per array. metric dan signal harus mengambil angka dari data.",
        },
        {
          role: "user",
          content: JSON.stringify({
            akun: { platform: input.profile.platform, username: input.profile.username, followersCount: input.followersCount },
            ringkasan: input.metrics.summary,
            tipeKonten: input.typeStats.map((item) => ({ type: item.contentType, count: item.count, averageEngagementRate: item.averageEngagementRate })),
            kontenTerbaru: input.contents.map((content) => ({
              title: content.title,
              type: content.contentType,
              publishedAt: content.publishedAt,
              views: content.views,
              likes: content.likes,
              comments: content.comments,
              shares: content.shares,
              engagementRate: content.engagementRate,
              unavailableFields: content.unavailableFields,
            })),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return parseVikeyInsightData(await response.json().catch(() => null));
}

function buildCompactInsightContext(input: EngagementInsightsInput) {
  const metrics = calculateEngagementMetrics(input.contents);
  const typeStats = aggregateContentTypeMetrics(input.contents);
  const topContents = [...input.contents]
    .sort((first, second) => second.engagementRate - first.engagementRate)
    .slice(0, 3)
    .map((content) => ({
      title: content.title,
      type: content.contentType,
      views: content.views,
      engagementRate: content.engagementRate,
    }));

  return {
    akun: { platform: input.profile.platform, username: input.profile.username, followersCount: input.followersCount },
    ringkasan: {
      erAverage: metrics.summary.erAverage,
      erMedian: metrics.summary.erMedian,
      erWeighted: metrics.summary.erWeighted,
      totalInteractions: metrics.totalInteractions,
      contentCount: input.contents.length,
    },
    tipeKonten: typeStats.slice(0, 4).map((item) => ({ type: item.contentType, count: item.count, averageEngagementRate: item.averageEngagementRate })),
    kontenTeratas: topContents,
    dataTidakTersedia: [...new Set(input.contents.flatMap((content) => content.unavailableFields))],
  };
}

function buildDeterministicAnswer(question: string, input: EngagementInsightsInput) {
  const context = buildCompactInsightContext(input);
  const lowerQuestion = question.toLowerCase();
  const bestType = context.tipeKonten[0];
  const bestContent = context.kontenTeratas[0];

  if (lowerQuestion.includes("format") || lowerQuestion.includes("tipe") || lowerQuestion.includes("konten")) {
    return bestType
      ? "Format terkuat saat ini adalah " + contentTypeLabel(bestType.type) + " dengan ER rata-rata " + bestType.averageEngagementRate.toFixed(2) + "%. Jadikan ini baseline, lalu uji variasi topik atau hook pada analisis berikutnya."
      : "Belum ada cukup data format untuk dibandingkan.";
  }
  if (lowerQuestion.includes("weighted") || lowerQuestion.includes("berbobot") || lowerQuestion.includes("er")) {
    return "ER rata-rata akun adalah " + context.ringkasan.erAverage.toFixed(2) + "%, median " + context.ringkasan.erMedian.toFixed(2) + "%, dan weighted ER " + context.ringkasan.erWeighted.toFixed(2) + "%. Weighted ER lebih menekankan konten dengan volume views yang lebih besar.";
  }
  if (lowerQuestion.includes("terbaik") || lowerQuestion.includes("unggul")) {
    return bestContent
      ? "Konten dengan performa terbaik adalah “" + bestContent.title + "” dengan ER " + bestContent.engagementRate.toFixed(2) + "% dan " + compactNumber(bestContent.views) + " views. Gunakan pola pembuka dan topiknya sebagai bahan eksperimen."
      : "Belum ada konten unggulan yang bisa dirangkum.";
  }
  return "Akun " + input.profile.username + " memiliki ER rata-rata " + context.ringkasan.erAverage.toFixed(2) + "% dari " + (context.ringkasan.contentCount || 20) + " konten. Fokus awal yang paling aman adalah mempertahankan " + (bestType ? contentTypeLabel(bestType.type) : "format dengan performa terbaik") + " sambil menguji satu perubahan pada konten berikutnya.";
}

async function generateVikeyAnswer(question: string, input: EngagementInsightsInput) {
  const rawAnswer = await requestVikeyChat([
    {
      role: "system",
      content: "Kamu adalah analis engagement berbahasa Indonesia. Jawab pertanyaan secara ringkas, maksimal 80 kata atau 3 bullet. Gunakan hanya konteks yang diberikan, jangan mengarang angka, dan jika data tidak cukup katakan terus terang.",
    },
    {
      role: "user",
      content: JSON.stringify({ pertanyaan: question.trim().slice(0, 500), konteks: buildCompactInsightContext(input) }),
    },
  ], 320);
  return rawAnswer ? rawAnswer.trim().slice(0, 900) : null;
}

/**
 * Membuat rekomendasi berbasis aturan dari format terbaik, kualitas data, dan
 * volume interaksi. Output sengaja berupa saran yang dapat ditelusuri ke data.
 */
export function buildContentRecommendations(contents: readonly EngagementContent[], typeStats = aggregateContentTypeMetrics(contents)): ContentRecommendation[] {
  const metrics = calculateEngagementMetrics(contents);
  const bestType = typeStats[0];
  const unavailableFields = [...new Set(contents.flatMap((content) => content.unavailableFields))];
  const sharesPartial = unavailableFields.includes("shares");
  const bestTypeLabel = contentTypeLabel(bestType?.contentType);

  return [
    {
      title: bestType ? `Pertahankan porsi ${bestTypeLabel}` : "Tambahkan variasi konten",
      description: bestType ? `Jadikan ${bestTypeLabel} sebagai format utama sambil menguji variasi topik dan hook.` : "Gunakan beberapa format agar perbandingan performa lebih bermakna.",
      priority: "Prioritas tinggi",
      signal: bestType ? `${bestType.count} konten` : "Mulai dari 3 format",
    },
    {
      title: sharesPartial ? "Uji kembali dengan data shares lengkap" : "Pertahankan pencatatan interaksi",
      description: sharesPartial ? "Bandingkan hasil berikutnya saat izin platform menyediakan shares pada seluruh konten." : "Pertahankan pemantauan likes, comments, dan shares pada analisis berikutnya.",
      priority: "Kualitas data",
      signal: sharesPartial ? "Shares parsial" : "Semua metrik tersedia",
    },
    {
      title: "Bandingkan hasil pada analisis berikutnya",
      description: `Gunakan ${contents.length || 20} konten terbaru untuk melihat apakah pola ini tetap konsisten.`,
      priority: "Uji berikutnya",
      signal: `${metrics.totalInteractions.toLocaleString("id-ID")} interaksi`,
    },
  ];
}

/**
 * Merangkum pola dari hasil analisis tanpa memanggil model AI. Semua insight
 * dapat diaudit dari ER, views, interaksi, format, dan availability konten.
 */
export async function buildEngagementInsights({ profile, followersCount, contents, source }: EngagementInsightsInput) {
  const metrics = calculateEngagementMetrics(contents);
  const typeStats = aggregateContentTypeMetrics(contents);
  const bestType = typeStats[0];
  const bestContent = contents.find((content) => content.id === metrics.summary.bestContentId) || contents[0];
  const unavailableFields = [...new Set(contents.flatMap((content) => content.unavailableFields))];
  const sharesPartial = unavailableFields.includes("shares");
  const bestTypeLabel = contentTypeLabel(bestType?.contentType);
  const recommendations = buildContentRecommendations(contents, typeStats);
  const aiInsights = await generateVikeyInsights({ profile, followersCount, contents, metrics, typeStats }).catch(() => null);

  return {
    profile,
    count: contents.length,
    followersCount,
    summary: aiInsights?.summary || [
      {
        title: bestType ? `${bestTypeLabel} jadi format terkuat` : "Belum ada format dominan",
        description: bestType ? "Format ini mencatat ER rata-rata paling tinggi pada analisis terbaru." : "Tambahkan konten agar pola performa dapat dirangkum.",
        metric: bestType ? `${bestType.averageEngagementRate.toFixed(2)}% ER` : "0.00% ER",
        label: "ER rata-rata",
      },
      {
        title: bestContent ? "Satu konten memimpin performa" : "Belum ada konten unggulan",
        description: bestContent ? `${bestContent.title} memiliki jangkauan tertinggi di antara konten yang dianalisis.` : "Belum ada data untuk menentukan konten unggulan.",
        metric: bestContent ? compactNumber(bestContent.views) : "0",
        label: "views tertinggi",
      },
      {
        title: sharesPartial ? "Lengkapi data shares bila tersedia" : "Data interaksi cukup lengkap",
        description: sharesPartial ? "Sebagian shares tidak tersedia, tetapi perhitungan ER tetap berjalan tanpa mengarang nilai." : "Metrik interaksi tersedia untuk seluruh konten yang dianalisis.",
        metric: `${metrics.summary.erWeighted.toFixed(2)}% ER`,
        label: "weighted ER",
      },
    ],
    recommendations: aiInsights?.recommendations || recommendations,
    dataAvailability: {
      unavailableFields,
      shares: sharesPartial ? "partial" : "available",
    },
    source: {
      ...source,
      provider: aiInsights ? "vikey" : "deterministic",
      message: aiInsights
        ? "Wawasan dirangkum Vikey AI menggunakan data " + (contents.length || 20) + " konten terbaru."
        : (source.message ? source.message + " " : "") + "Wawasan dibuat dari aturan deterministik karena Vikey AI belum dikonfigurasi atau belum merespons.",
    },
  };
}

export async function answerEngagementQuestion(input: EngagementInsightsInput, question: string) {
  const aiAnswer = await generateVikeyAnswer(question, input);
  return {
    answer: aiAnswer || buildDeterministicAnswer(question, input),
    provider: aiAnswer ? "vikey" as const : "deterministic" as const,
  };
}
