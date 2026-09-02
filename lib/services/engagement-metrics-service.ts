import type { EngagementContent } from "@/lib/services/engagement-content-service";

export type EngagementSummary = {
  erAverage: number;
  erMedian: number;
  erWeighted: number;
  bestContentId: string | null;
};

export type EngagementMetrics = {
  summary: EngagementSummary;
  totalInteractions: number;
  totalViews: number;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

/**
 * Menghitung ringkasan ER dari konten yang sudah diambil tanpa bergantung pada
 * provider platform. Formula inti tetap bisa dipakai saat mock diganti API resmi.
 */
export function calculateEngagementMetrics(contents: readonly EngagementContent[]): EngagementMetrics {
  if (contents.length === 0) {
    return {
      summary: { erAverage: 0, erMedian: 0, erWeighted: 0, bestContentId: null },
      totalInteractions: 0,
      totalViews: 0,
    };
  }

  const engagementRates = contents.map((content) => content.engagementRate).sort((a, b) => a - b);
  const totalInteractions = contents.reduce((total, content) => total + content.likes + content.comments + (content.shares ?? 0), 0);
  const totalViews = contents.reduce((total, content) => total + content.views, 0);
  const middleIndex = Math.floor(engagementRates.length / 2);
  const erMedian = engagementRates.length % 2 === 0
    ? (engagementRates[middleIndex - 1] + engagementRates[middleIndex]) / 2
    : engagementRates[middleIndex];
  const bestContent = contents.reduce((best, content) => (
    content.engagementRate > best.engagementRate ? content : best
  ));

  return {
    summary: {
      erAverage: round(engagementRates.reduce((total, rate) => total + rate, 0) / engagementRates.length),
      erMedian: round(erMedian),
      erWeighted: totalViews === 0 ? 0 : round((totalInteractions / totalViews) * 100),
      bestContentId: bestContent.id,
    },
    totalInteractions,
    totalViews,
  };
}
