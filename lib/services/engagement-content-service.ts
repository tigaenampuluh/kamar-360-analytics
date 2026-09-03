export type EngagementPlatform = "instagram" | "tiktok" | "youtube";
export type EngagementContentType = "photo" | "carousel" | "reels" | "tiktok_video" | "youtube_video" | "shorts";

export type EngagementProfile = {
  platform: EngagementPlatform;
  username: string;
  profileUrl: string;
};

export type EngagementContent = {
  id: string;
  platform: EngagementPlatform;
  contentType: EngagementContentType;
  title: string;
  caption: string | null;
  thumbnailUrl: string | null;
  externalId: string;
  url: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  engagementRate: number;
  isBest: boolean;
  unavailableFields: string[];
};

export type ContentEngagementInput = Pick<EngagementContent, "likes" | "comments" | "shares"> & {
  followersCount: number;
};

export const LATEST_CONTENT_LIMIT = 20;

function hashSeed(value: string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function nextRandom(seed: { value: number }) {
  seed.value = (Math.imul(seed.value, 1_664_525) + 1_013_904_223) >>> 0;
  return seed.value / 4_294_967_296;
}

function round(value: number) {
  return Number(value.toFixed(2));
}

/**
 * Menghitung ER satu konten memakai followers sebagai pembagi.
 * Shares null berarti metriknya tidak tersedia dan tidak ikut dihitung.
 */
export function calculateContentEngagementRate({ likes, comments, shares, followersCount }: ContentEngagementInput) {
  if (followersCount <= 0) return 0;

  const totalInteractions = likes + comments + (shares ?? 0);
  return round((totalInteractions / followersCount) * 100);
}

function contentTypesFor(platform: EngagementPlatform): EngagementContentType[] {
  if (platform === "instagram") return ["reels", "carousel", "photo"];
  if (platform === "tiktok") return ["tiktok_video"];
  return ["youtube_video", "shorts"];
}

function contentUrl(profile: EngagementProfile, externalId: string, contentType: EngagementContentType) {
  if (profile.platform === "instagram") return `https://www.instagram.com/p/${externalId}`;
  if (profile.platform === "tiktok") return `https://www.tiktok.com/@${profile.username}/video/${externalId}`;
  if (contentType === "shorts") return `https://www.youtube.com/shorts/${externalId}`;
  return `https://www.youtube.com/watch?v=${externalId}`;
}

function mockThumbnail(type: EngagementContentType, index: number) {
  const palette: Record<EngagementContentType, [string, string]> = {
    reels: ["#d8c8ff", "#8e70d8"],
    carousel: ["#c9eaff", "#65a8d8"],
    photo: ["#ffe0cc", "#e99a6e"],
    tiktok_video: ["#d9f5ee", "#4ea894"],
    youtube_video: ["#dff4e8", "#72b88c"],
    shorts: ["#fff0bf", "#e2b654"],
  };
  const [start, end] = palette[type];
  const label = type.replace("_", " ").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="640" height="420" rx="28" fill="url(#g)"/><circle cx="520" cy="100" r="110" fill="rgba(255,255,255,.26)"/><circle cx="120" cy="360" r="150" fill="rgba(255,255,255,.2)"/><path d="M286 168a42 42 0 1 1 0 84l-52-42 52-42Z" fill="rgba(38,50,71,.62)"/><text x="32" y="368" fill="rgba(38,50,71,.62)" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="2">${label}</text><text x="568" y="368" text-anchor="end" fill="rgba(38,50,71,.5)" font-family="Arial,sans-serif" font-size="18">${String(index + 1).padStart(2, "0")}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Temporary mock adapter for the latest-content contract. The API connectors
 * can replace this implementation without changing the analysis endpoint.
 */
export function getLatestContentBatch(profile: EngagementProfile, now = new Date()) {
  const random = { value: hashSeed(profile.profileUrl) };
  const followersCount = Math.round(25_000 + nextRandom(random) * 475_000);
  const types = contentTypesFor(profile.platform);
  const contents = Array.from({ length: LATEST_CONTENT_LIMIT }, (_, index) => {
    const contentType = types[index % types.length];
    const externalId = `${profile.platform.slice(0, 2)}${hashSeed(`${profile.username}-${index}`).toString(36)}`;
    const views = Math.round(followersCount * (0.35 + nextRandom(random) * 1.65));
    const likes = Math.round(views * (0.025 + nextRandom(random) * 0.065));
    const comments = Math.round(likes * (0.04 + nextRandom(random) * 0.12));
    const sharesUnavailable = profile.platform === "youtube" && index % 4 === 0;
    const shares = sharesUnavailable ? null : Math.round(likes * (0.08 + nextRandom(random) * 0.22));
    const engagementRate = calculateContentEngagementRate({ likes, comments, shares, followersCount });

    return {
      id: `${profile.platform}-${index + 1}`,
      platform: profile.platform,
      contentType,
      title: `${contentType.replace("_", " ")} ${String(index + 1).padStart(2, "0")}`,
      caption: `Ide konten ${contentType.replace("_", " ")} untuk ${profile.username}. Data ini adalah preview sampai metadata publik tersedia.`,
      thumbnailUrl: mockThumbnail(contentType, index),
      externalId,
      url: contentUrl(profile, externalId, contentType),
      publishedAt: new Date(now.getTime() - index * 86_400_000).toISOString(),
      views,
      likes,
      comments,
      shares,
      engagementRate,
      isBest: false,
      unavailableFields: sharesUnavailable ? ["shares"] : [],
    };
  });

  const bestIndex = contents.reduce((best, content, index) => (
    content.engagementRate > contents[best].engagementRate ? index : best
  ), 0);
  contents[bestIndex].isBest = true;

  return { followersCount, contents };
}
