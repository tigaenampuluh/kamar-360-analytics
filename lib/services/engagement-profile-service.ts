import type { EngagementPlatform, EngagementProfile } from "@/lib/services/engagement-content-service";

const usernamePattern = /^[a-zA-Z0-9._-]{2,50}$/;
const instagramReservedPaths = new Set(["accounts", "direct", "explore", "reels", "stories", "about", "developer"]);
const platformHosts: Record<EngagementPlatform, ReadonlySet<string>> = {
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  tiktok: new Set(["tiktok.com", "www.tiktok.com"]),
  youtube: new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]),
};

function isPlatformHost(hostname: string, platform: EngagementPlatform) {
  return platformHosts[platform].has(hostname.toLowerCase());
}

function pathSegments(url: URL) {
  return url.pathname.split("/").filter(Boolean);
}

export function normalizeEngagementProfileUrl(value: string): EngagementProfile | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;

  const segments = pathSegments(url);
  const firstSegment = segments[0] || null;
  if (isPlatformHost(url.hostname, "instagram")) {
    if (segments.length !== 1 || !firstSegment || instagramReservedPaths.has(firstSegment.toLowerCase()) || !usernamePattern.test(firstSegment)) return null;
    return { platform: "instagram", username: firstSegment, profileUrl: `https://www.instagram.com/${firstSegment}` };
  }

  if (isPlatformHost(url.hostname, "tiktok")) {
    if (segments.length !== 1 || !firstSegment?.startsWith("@") || !usernamePattern.test(firstSegment.slice(1))) return null;
    return { platform: "tiktok", username: firstSegment.slice(1), profileUrl: `https://www.tiktok.com/${firstSegment}` };
  }

  if (isPlatformHost(url.hostname, "youtube")) {
    if (!firstSegment) return null;
    if (segments.length === 1 && firstSegment.startsWith("@") && usernamePattern.test(firstSegment.slice(1))) {
      return { platform: "youtube", username: firstSegment.slice(1), profileUrl: `https://www.youtube.com/${firstSegment}` };
    }

    const channelType = firstSegment.toLowerCase();
    const channelId = segments[1];
    if (segments.length === 2 && ["channel", "c", "user"].includes(channelType) && channelId && usernamePattern.test(channelId)) {
      return { platform: "youtube", username: channelId, profileUrl: `https://www.youtube.com/${channelType}/${channelId}` };
    }
  }

  return null;
}
