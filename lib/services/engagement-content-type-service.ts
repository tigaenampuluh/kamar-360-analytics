import type { EngagementContent, EngagementContentType } from "@/lib/services/engagement-content-service";

export type ContentTypeRecap = {
  contentType: EngagementContentType;
  count: number;
  averageEngagementRate: number;
  totalInteractions: number;
  totalViews: number;
  shares: "available" | "partial";
  unavailableFields: string[];
};

type ContentForRecap = Pick<EngagementContent, "contentType" | "engagementRate" | "views" | "likes" | "comments" | "shares" | "unavailableFields">;

function round(value: number) {
  return Number(value.toFixed(2));
}

/**
 * Mengelompokkan konten berdasarkan format dan menghitung performa tiap grup.
 * ER grup adalah rata-rata ER per konten; shares null dihitung nol untuk total
 * interaksi, tetapi tetap dilaporkan sebagai data parsial.
 */
export function aggregateContentTypeMetrics(contents: readonly ContentForRecap[]): ContentTypeRecap[] {
  const grouped = new Map<EngagementContentType, ContentForRecap[]>();
  for (const content of contents) {
    grouped.set(content.contentType, [...(grouped.get(content.contentType) || []), content]);
  }

  return [...grouped.entries()]
    .map(([contentType, items]) => {
      const totalInteractions = items.reduce((total, item) => total + item.likes + item.comments + (item.shares ?? 0), 0);
      const totalViews = items.reduce((total, item) => total + item.views, 0);
      const unavailableFields = [...new Set(items.flatMap((item) => item.unavailableFields))];
      const shares: ContentTypeRecap["shares"] = unavailableFields.includes("shares") ? "partial" : "available";

      return {
        contentType,
        count: items.length,
        averageEngagementRate: round(items.reduce((total, item) => total + item.engagementRate, 0) / items.length),
        totalInteractions,
        totalViews,
        shares,
        unavailableFields,
      };
    })
    .sort((first, second) => second.averageEngagementRate - first.averageEngagementRate);
}
