import {
  getLatestContentBatch,
  type EngagementProfile,
  type EngagementContent,
  type EngagementContentType,
  LATEST_CONTENT_LIMIT,
  calculateContentEngagementRate,
} from "@/lib/services/engagement-content-service";
import { calculateEngagementMetrics } from "@/lib/services/engagement-metrics-service";

export type PublicComparisonSource = "public" | "partial" | "mock";

export type PublicComparisonAccount = {
  profileUrl: string;
  platform: EngagementProfile["platform"];
  username: string;
  followersCount: number;
  erAverage: number;
  erWeighted: number;
  totalInteractions: number;
  source: PublicComparisonSource;
  sourceLabel: string;
  sourceMessage: string;
  fetchedTitle: string | null;
};

export type PublicContentBatch = {
  followersCount: number;
  contents: EngagementContent[];
  source: {
    mode: PublicComparisonSource;
    status: "ready" | "partial" | "preview";
    message: string | null;
  };
  fetchedTitle: string | null;
};

const requestTimeoutMs = 7_000;
const maxRedirects = 3;
const maxHtmlCharacters = 2_000_000;

const profileHosts: Record<EngagementProfile["platform"], ReadonlySet<string>> = {
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  tiktok: new Set(["tiktok.com", "www.tiktok.com"]),
  youtube: new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]),
};

function isAllowedHost(value: URL, platform: EngagementProfile["platform"]) {
  return value.protocol === "https:" && profileHosts[platform].has(value.hostname.toLowerCase()) && !value.username && !value.password && !value.port;
}

async function fetchPublicHtmlForUrl(startUrl: string, platform: EngagementProfile["platform"]) {
  let currentUrl = startUrl;

  for (let attempt = 0; attempt <= maxRedirects; attempt += 1) {
    const response = await fetch(currentUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "PulseCheckPublicPreview/1.0 (+public-profile-inspection)",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeoutMs),
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || attempt === maxRedirects) throw new Error("redirect-limit");
      const nextUrl = new URL(location, currentUrl);
      if (!isAllowedHost(nextUrl, platform)) throw new Error("redirect-host-not-allowed");
      currentUrl = nextUrl.toString();
      continue;
    }

    if (!response.ok) throw new Error(`public-profile-${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("not-html");
    return (await response.text()).slice(0, maxHtmlCharacters);
  }

  throw new Error("redirect-limit");
}

async function fetchPublicHtml(profile: EngagementProfile) {
  return fetchPublicHtmlForUrl(profile.profileUrl, profile.platform);
}

function readAttribute(tag: string, attribute: string) {
  const match = tag.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] || null;
}

function readMetaValue(html: string, key: string) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = readAttribute(tag, "name") || readAttribute(tag, "property");
    if (name?.toLowerCase() === key.toLowerCase()) return readAttribute(tag, "content");
  }
  return null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseCount(value: string) {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  const suffix = normalized.match(/[KMB]$/)?.[0] || "";
  let numberPart = suffix ? normalized.slice(0, -1) : normalized;
  if (numberPart.includes(",") && numberPart.includes(".")) {
    numberPart = numberPart.lastIndexOf(",") > numberPart.lastIndexOf(".")
      ? numberPart.replace(/\./g, "").replace(",", ".")
      : numberPart.replace(/,/g, "");
  } else if (numberPart.includes(",")) {
    numberPart = /,\d{1,2}$/.test(numberPart) ? numberPart.replace(",", ".") : numberPart.replace(/,/g, "");
  } else if (numberPart.includes(".")) {
    numberPart = /\.\d{1,2}$/.test(numberPart) ? numberPart : numberPart.replace(/\./g, "");
  }

  const parsed = Number(numberPart);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const multiplier = suffix === "M" ? 1_000_000 : suffix === "K" ? 1_000 : suffix === "B" ? 1_000_000_000 : 1;
  return Math.round(parsed * multiplier);
}

function extractFollowersCount(html: string, platform: EngagementProfile["platform"]) {
  const decoded = decodeHtml(html);
  const patterns = platform === "youtube"
    ? [
        /["']subscriberCount["']\s*:\s*["']?([\d.,]+)["']?/i,
        /([\d.,]+\s*[KMB]?)\s*(?:subscribers|subscriber)/i,
      ]
    : [
        /["'](?:followers|follower_count|edge_followed_by)["']\s*(?:[:=]|[^0-9]){0,60}([\d.,]+\s*[KMB]?)/i,
        /([\d.,]+\s*[KMB]?)\s*(?:followers|follower)/i,
      ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    const count = match?.[1] ? parseCount(match[1]) : null;
    if (count !== null && count > 0) return count;
  }
  return null;
}

function extractTitle(html: string) {
  const socialTitle = readMetaValue(html, "og:title") || readMetaValue(html, "twitter:title");
  if (socialTitle) return decodeHtml(socialTitle).trim().slice(0, 160);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtml(title.replace(/<[^>]+>/g, "")).trim().slice(0, 160) : null;
}

function extractContentUrls(html: string, profile: EngagementProfile) {
  const source = decodeHtml(html).replaceAll("\\/", "/");
  const patterns: RegExp[] = profile.platform === "instagram"
    ? [/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[A-Za-z0-9_-]+/gi]
    : profile.platform === "tiktok"
      ? [new RegExp("https?:\\/\\/(?:www\\.)?tiktok\\.com\\/@"
        + profile.username.replace(/[\^$.*+?()[\]{}|]/g, "\\$&")
        + "\\/video\\/[0-9]+", "gi")]
      : [/https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|shorts\/)[A-Za-z0-9_-]+/gi];

  const urls = patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[0].replace(/[),\\"]+$/, "")));
  return [...new Set(urls)].slice(0, LATEST_CONTENT_LIMIT);
}

function extractMetric(html: string, patterns: RegExp[]) {
  const decoded = decodeHtml(html);
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    const count = match?.[1] ? parseCount(match[1]) : null;
    if (count !== null) return count;
  }
  return null;
}

function contentTypeFromUrl(profile: EngagementProfile, url: string): EngagementContentType {
  if (profile.platform === "instagram") return url.includes("/reel/") ? "reels" : "photo";
  if (profile.platform === "tiktok") return "tiktok_video";
  return url.includes("/shorts/") ? "shorts" : "youtube_video";
}

function externalIdFromUrl(url: string, index: number) {
  const parts = url.split("/").filter(Boolean);
  const lastPart = parts[parts.length - 1] || String(index + 1);
  return lastPart.split("?")[0].slice(0, 120);
}

function publishedAtFromHtml(html: string, fallback: Date) {
  const published = readMetaValue(html, "article:published_time") || readMetaValue(html, "datePublished");
  if (!published || Number.isNaN(new Date(published).getTime())) return fallback.toISOString();
  return new Date(published).toISOString();
}

async function inspectPublicContent(profile: EngagementProfile, url: string, index: number, followersCount: number, now: Date): Promise<EngagementContent | null> {
  try {
    const html = await fetchPublicHtmlForUrl(url, profile.platform);
    const views = extractMetric(html, [
      /["'](?:viewCount|views)["']\s*:\s*["']?([\d.,]+\s*[KMB]?)/i,
      /([\d.,]+\s*[KMB]?)\s*(?:views?|tayangan|ditonton)/i,
    ]);
    const likes = extractMetric(html, [
      /["'](?:likeCount|likes)["']\s*:\s*["']?([\d.,]+\s*[KMB]?)/i,
      /([\d.,]+\s*[KMB]?)\s*(?:likes?|suka)/i,
    ]);
    const comments = extractMetric(html, [
      /["'](?:commentCount|comments)["']\s*:\s*["']?([\d.,]+\s*[KMB]?)/i,
      /([\d.,]+\s*[KMB]?)\s*(?:comments?|komentar)/i,
    ]);
    if (likes === null || comments === null || followersCount <= 0) return null;

    const shares = extractMetric(html, [
      /["'](?:shareCount|shares)["']\s*:\s*["']?([\d.,]+\s*[KMB]?)/i,
      /([\d.,]+\s*[KMB]?)\s*(?:shares?|dibagikan)/i,
    ]);
    const contentType = contentTypeFromUrl(profile, url);
    const unavailableFields = [
      ...(views === null ? ["views"] : []),
      ...(shares === null ? ["shares"] : []),
    ];
    const externalId = externalIdFromUrl(url, index);
    return {
      id: profile.platform + "-public-" + (index + 1),
      platform: profile.platform,
      contentType,
      title: extractTitle(html) || contentType.replace("_", " ") + " " + String(index + 1).padStart(2, "0"),
      externalId,
      url,
      publishedAt: publishedAtFromHtml(html, new Date(now.getTime() - index * 86_400_000)),
      views: views || 0,
      likes,
      comments,
      shares,
      engagementRate: calculateContentEngagementRate({ likes, comments, shares, followersCount }),
      isBest: false,
      unavailableFields,
    } satisfies EngagementContent;
  } catch {
    return null;
  }
}

export async function getLatestPublicContent(profile: EngagementProfile, now = new Date()): Promise<PublicContentBatch> {
  const fallback = getLatestContentBatch(profile, now);
  try {
    const html = await fetchPublicHtml(profile);
    const fetchedTitle = extractTitle(html);
    const publicFollowersCount = extractFollowersCount(html, profile.platform);
    const contentUrls = extractContentUrls(html, profile);
    const publicContents = (await Promise.all(contentUrls.map((url, index) => inspectPublicContent(profile, url, index, publicFollowersCount || fallback.followersCount, now))))
      .filter((content): content is EngagementContent => content !== null)
      .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
      .slice(0, LATEST_CONTENT_LIMIT);

    if (publicContents.length > 0) {
      const bestIndex = publicContents.reduce((best, content, index) => content.engagementRate > publicContents[best].engagementRate ? index : best, 0);
      publicContents[bestIndex].isBest = true;
      return {
        followersCount: publicFollowersCount || fallback.followersCount,
        contents: publicContents,
        source: {
          mode: publicContents.length === contentUrls.length ? "public" : "partial",
          status: publicContents.length === contentUrls.length ? "ready" : "partial",
          message: publicContents.length === contentUrls.length
            ? "Metrik konten berhasil dibaca dari halaman publik."
            : "Sebagian konten publik berhasil dibaca; metrik lainnya tidak terbuka.",
        },
        fetchedTitle,
      };
    }

    return {
      followersCount: fallback.followersCount,
      contents: fallback.contents,
      source: {
        mode: "mock",
        status: "preview",
        message: contentUrls.length > 0
          ? "URL konten publik ditemukan, tetapi metrik konten tidak terbuka; memakai data preview."
          : "Halaman publik tidak mengekspos URL dan metrik konten terbaru; memakai data preview.",
      },
      fetchedTitle,
    };
  } catch {
    return {
      followersCount: fallback.followersCount,
      contents: fallback.contents,
      source: { mode: "mock", status: "preview", message: "Crawl publik belum berhasil; memakai data preview." },
      fetchedTitle: null,
    };
  }
}

async function inspectPublicProfile(profile: EngagementProfile): Promise<PublicComparisonAccount> {
  const batch = await getLatestPublicContent(profile);
  const metrics = calculateEngagementMetrics(batch.contents);
  const sourceLabel = batch.source.mode === "public"
    ? "Data publik"
    : batch.source.mode === "partial"
      ? "Data publik parsial"
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
    fetchedTitle: batch.fetchedTitle,
  };
}

export async function comparePublicProfiles(profiles: readonly EngagementProfile[]) {
  return Promise.all(profiles.map((profile) => inspectPublicProfile(profile)));
}
