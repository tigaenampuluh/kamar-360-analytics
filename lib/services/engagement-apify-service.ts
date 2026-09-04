import {
  calculateContentEngagementRate,
  LATEST_CONTENT_LIMIT,
  type EngagementContent,
  type EngagementContentType,
  type EngagementPlatform,
  type EngagementProfile,
} from "@/lib/services/engagement-content-service";

type ApifySource = {
  mode: "apify";
  status: "ready" | "partial";
  message: string | null;
  provider: "apify";
};

export type ApifyContentBatch = {
  followersCount: number;
  contents: EngagementContent[];
  source: ApifySource;
};

type JsonRecord = Record<string, unknown>;

const apifyApiBaseUrl = "https://api.apify.com/v2";
const apifyRequestTimeoutMs = 45_000;
const apifyCacheTtlMs = 5 * 60 * 1_000;
const apifyCache = new Map<string, { expiresAt: number; batch: ApifyContentBatch }>();
const apifyInFlight = new Map<string, Promise<ApifyContentBatch>>();

const defaultActorIds: Record<EngagementPlatform, string> = {
  instagram: "apify/instagram-scraper",
  tiktok: "clockworks/tiktok-scraper",
  youtube: "scraper-engine/youtube-scraper",
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function numberFromValue(value: unknown) {
  const direct = finiteNumber(value);
  if (direct !== null) return direct;
  const record = asRecord(value);
  if (!record) return null;
  return finiteNumber(record.count) ?? finiteNumber(record.value) ?? finiteNumber(record.total);
}

function firstNumber(records: readonly JsonRecord[], keys: readonly string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = numberFromValue(record[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function firstString(records: readonly JsonRecord[], keys: readonly string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = asString(record[key]);
      if (value) return value;
    }
  }
  return null;
}

function nestedRecords(item: JsonRecord) {
  return [
    item,
    asRecord(item.profile),
    asRecord(item.author),
    asRecord(item.authorMeta),
    asRecord(item.authorStats),
    asRecord(item.channel),
    asRecord(item.stats),
    asRecord(item.parentData),
    asRecord(asRecord(item.parentData)?.profile),
  ].filter((value): value is JsonRecord => value !== null);
}

function followersFromItem(item: JsonRecord) {
  return firstNumber(nestedRecords(item), [
    "followersCount",
    "followerCount",
    "followers",
    "fans",
    "numberOfSubscribers",
    "subscriberCount",
    "subscribers",
    "authorFollowers",
  ]);
}

function followersFromItems(items: readonly unknown[]) {
  return items
    .map(asRecord)
    .filter((value): value is JsonRecord => value !== null)
    .reduce<number>((current, item) => Math.max(current, followersFromItem(item) || 0), 0);
}

function metricFromItem(item: JsonRecord, keys: readonly string[]) {
  return firstNumber([item], keys);
}

function canonicalUrl(profile: EngagementProfile, externalId: string | null, rawUrl: string | null, contentType: EngagementContentType) {
  if (rawUrl?.startsWith("https://")) return rawUrl;
  if (!externalId) return null;
  if (profile.platform === "instagram") return `https://www.instagram.com/p/${externalId}/`;
  if (profile.platform === "tiktok") return `https://www.tiktok.com/@${profile.username}/video/${externalId}`;
  return contentType === "shorts"
    ? `https://www.youtube.com/shorts/${externalId}`
    : `https://www.youtube.com/watch?v=${externalId}`;
}

function parseDate(value: unknown, fallback: Date) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const timestamp = value < 10_000_000_000 ? value * 1_000 : value;
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const stringValue = asString(value);
  if (stringValue) {
    const date = new Date(stringValue);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback.toISOString();
}

function safeHttpsUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function contentTypeFor(profile: EngagementProfile, item: JsonRecord, url: string | null): EngagementContentType {
  if (profile.platform === "tiktok") return "tiktok_video";
  if (profile.platform === "youtube") {
    const type = (asString(item.type) || "").toLowerCase();
    return type === "shorts" || url?.includes("/shorts/") ? "shorts" : "youtube_video";
  }

  const type = (asString(item.type) || "").toLowerCase();
  const productType = (asString(item.productType) || "").toLowerCase();
  const section = (asString(item.section) || "").toLowerCase();
  if (type === "sidecar" || productType.includes("carousel")) return "carousel";
  if (section === "reels" || productType === "clips" || productType.includes("reel")) return "reels";
  return "photo";
}

function shortTitle(value: string | null) {
  if (!value) return null;
  const firstLine = value.split(/\r?\n/, 1)[0]?.trim();
  return firstLine ? firstLine.slice(0, 120) : null;
}

function platformTitle(profile: EngagementProfile, contentType: EngagementContentType, index: number) {
  const label = contentType === "tiktok_video"
    ? "TikTok"
    : contentType === "youtube_video" || contentType === "shorts"
      ? "YouTube"
      : "Instagram";
  return `${label} ${contentType.replace("_", " ")} ${String(index + 1).padStart(2, "0")}`;
}

function externalIdFromItem(item: JsonRecord) {
  return firstString([item], ["shortCode", "shortcode", "videoId", "video_id", "videoID", "aweme_id", "id", "key"]);
}

function normalizeItem(profile: EngagementProfile, item: JsonRecord, index: number, followersCount: number, now: Date): EngagementContent | null {
  const caption = firstString([item], ["caption", "description", "text", "desc", "content_desc", "contentDescription"]);
  const provisionalType = contentTypeFor(profile, item, firstString([item], ["url", "videoUrl", "webVideoUrl", "postUrl"]));
  const externalId = externalIdFromItem(item);
  const rawUrl = safeHttpsUrl(firstString([item], ["url", "videoUrl", "webVideoUrl", "postUrl"]));
  const url = canonicalUrl(profile, externalId, rawUrl, provisionalType);
  if (!url || !externalId) return null;

  const contentType = contentTypeFor(profile, item, url);
  const views = metricFromItem(item, ["viewCount", "views", "viewsCount", "videoViewCount", "playCount", "play_count", "plays"]);
  const likes = metricFromItem(item, ["likesCount", "likeCount", "likes", "diggCount", "digg_count"]);
  const comments = metricFromItem(item, ["commentsCount", "commentCount", "comments", "comment_count"]);
  const shares = metricFromItem(item, ["sharesCount", "shareCount", "shares", "share_count"]);
  const unavailableFields = [
    ...(views === null ? ["views"] : []),
    ...(likes === null ? ["likes"] : []),
    ...(comments === null ? ["comments"] : []),
    ...(shares === null ? ["shares"] : []),
  ];
  const normalizedViews = views ?? 0;
  const normalizedLikes = likes ?? 0;
  const normalizedComments = comments ?? 0;
  const engagementRate = calculateContentEngagementRate({
    likes: normalizedLikes,
    comments: normalizedComments,
    shares,
    followersCount,
  });
  const publishedAt = parseDate(
    firstString([item], ["timestamp", "timestampIso", "takenAtIso", "date", "publishedAt", "uploadDate", "createTimeIso", "create_time"])
      || item.timestamp
      || item.takenAt
      || item.createTime,
    new Date(now.getTime() - index * 86_400_000),
  );
  const thumbnailUrl = safeHttpsUrl(firstString([item], ["displayUrl", "thumbnailUrl", "thumbnail", "coverUrl", "cover", "originCoverUrl"]));
  const title = firstString([item], ["title", "videoTitle", "name"]) || shortTitle(caption) || platformTitle(profile, contentType, index);

  return {
    id: `${profile.platform}-apify-${externalId}`,
    platform: profile.platform,
    contentType,
    title: title.slice(0, 160),
    caption: caption ? caption.slice(0, 2_000) : null,
    thumbnailUrl,
    externalId: externalId.slice(0, 160),
    url,
    publishedAt,
    views: normalizedViews,
    likes: normalizedLikes,
    comments: normalizedComments,
    shares,
    engagementRate,
    isBest: false,
    unavailableFields,
  };
}

function actorIdFor(platform: EngagementPlatform) {
  const envName = `APIFY_${platform.toUpperCase()}_ACTOR_ID` as keyof NodeJS.ProcessEnv;
  return process.env[envName]?.trim() || defaultActorIds[platform];
}

function actorPath(actorId: string) {
  return encodeURIComponent(actorId.replaceAll("/", "~"));
}

function actorInput(profile: EngagementProfile): JsonRecord {
  if (profile.platform === "instagram") {
    return {
      directUrls: [profile.profileUrl],
      resultsType: "posts",
      resultsLimit: LATEST_CONTENT_LIMIT,
      addParentData: true,
    };
  }
  if (profile.platform === "tiktok") {
    return {
      profiles: [profile.username],
      profileScrapeSections: ["videos"],
      profileSorting: "latest",
      resultsPerPage: LATEST_CONTENT_LIMIT,
      excludePinnedPosts: false,
      shouldDownloadCovers: false,
    };
  }
  return {
    startUrls: [profile.profileUrl],
    maxVideos: 10,
    maxShorts: 10,
    maxStreams: 0,
    downloadSubtitles: false,
    sortBy: "date",
  };
}

function instagramDetailsInput(profile: EngagementProfile): JsonRecord {
  return {
    directUrls: [profile.profileUrl],
    resultsType: "details",
    resultsLimit: 1,
  };
}

async function runActor(profile: EngagementProfile, token: string, input: JsonRecord = actorInput(profile)) {
  const endpoint = `${apifyApiBaseUrl}/acts/${actorPath(actorIdFor(profile.platform))}/run-sync-get-dataset-items`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    body: JSON.stringify(input),
      signal: AbortSignal.timeout(apifyRequestTimeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(error instanceof DOMException && error.name === "TimeoutError" ? "apify-timeout" : "apify-network");
  }
  if (!response.ok) throw new Error(`apify-http-${response.status}`);
  const payload: unknown = await response.json().catch(() => null);
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  const items = record?.items;
  return Array.isArray(items) ? items : [];
}

function normalizeBatch(profile: EngagementProfile, items: readonly unknown[], now: Date): ApifyContentBatch {
  const records = items.map(asRecord).filter((value): value is JsonRecord => value !== null);
  const followersCount = followersFromItems(records);
  const contents = records
    .map((item, index) => normalizeItem(profile, item, index, followersCount, now))
    .filter((content): content is EngagementContent => content !== null)
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
    .filter((content, index, all) => all.findIndex((candidate) => candidate.externalId === content.externalId || candidate.url === content.url) === index)
    .slice(0, LATEST_CONTENT_LIMIT);

  if (contents.length === 0) throw new Error("apify-empty");
  const bestIndex = contents.reduce((best, content, index) => content.engagementRate > contents[best].engagementRate ? index : best, 0);
  contents[bestIndex].isBest = true;
  const hasUnavailableFields = followersCount <= 0 || contents.some((content) => content.unavailableFields.length > 0);

  return {
    followersCount,
    contents,
    source: {
      mode: "apify",
      status: hasUnavailableFields ? "partial" : "ready",
      message: hasUnavailableFields
        ? "Data publik berhasil diambil Apify, tetapi sebagian metrik tidak tersedia dari platform."
        : "Data konten publik berhasil diambil Apify.",
      provider: "apify",
    },
  };
}

function applyFollowerCount(batch: ApifyContentBatch, followersCount: number): ApifyContentBatch {
  const contents = batch.contents.map((content) => ({
    ...content,
    engagementRate: calculateContentEngagementRate({
      likes: content.likes,
      comments: content.comments,
      shares: content.shares,
      followersCount,
    }),
    isBest: false,
  }));
  const bestIndex = contents.reduce((best, content, index) => content.engagementRate > contents[best].engagementRate ? index : best, 0);
  if (contents[bestIndex]) contents[bestIndex].isBest = true;
  return {
    ...batch,
    followersCount,
    contents,
    source: {
      ...batch.source,
      status: contents.some((content) => content.unavailableFields.length > 0) ? "partial" : "ready",
      message: contents.some((content) => content.unavailableFields.length > 0)
        ? "Data publik berhasil diambil Apify, tetapi sebagian metrik tidak tersedia dari platform."
        : "Data konten publik berhasil diambil Apify.",
    },
  };
}

export function isApifyConfigured() {
  return Boolean(process.env.APIFY_API_TOKEN?.trim());
}

/**
 * Mengambil data publik melalui Apify. Hasil sukses di-cache singkat agar
 * membuka ringkasan, perbandingan, dan Wawasan tidak memicu scrape berulang.
 */
export async function getLatestApifyContent(profile: EngagementProfile, now = new Date()) {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return null;

  const cacheKey = `${profile.platform}:${profile.profileUrl}`;
  const cached = apifyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.batch;
  if (cached) apifyCache.delete(cacheKey);

  const activeRequest = apifyInFlight.get(cacheKey);
  if (activeRequest) return activeRequest;

  const request = runActor(profile, token)
    .then(async (items) => {
      const batch = normalizeBatch(profile, items, now);
      if (profile.platform !== "instagram" || batch.followersCount > 0) return batch;

      try {
        const detailItems = await runActor(profile, token, instagramDetailsInput(profile));
        const followersCount = followersFromItems(detailItems);
        return followersCount > 0 ? applyFollowerCount(batch, followersCount) : batch;
      } catch {
        return batch;
      }
    })
    .then((batch) => {
      apifyCache.set(cacheKey, { expiresAt: Date.now() + apifyCacheTtlMs, batch });
      return batch;
    })
    .finally(() => {
      apifyInFlight.delete(cacheKey);
    });
  apifyInFlight.set(cacheKey, request);
  return request;
}
