import {
  LATEST_CONTENT_LIMIT,
  type EngagementContent,
  type EngagementPlatform,
  type EngagementProfile,
} from "@/lib/services/engagement-content-service";
import { getLatestApifyContent, isApifyConfigured } from "@/lib/services/engagement-apify-service";
import { getLatestPublicContent } from "@/lib/services/engagement-public-profile-service";

export type PlatformContentConnection = {
  providerAccountId: string;
  status: "connected" | "expired" | "revoked" | "error";
  accessToken: string | null;
};

export type PlatformContentSource = {
  mode: "official" | "apify" | "public" | "partial" | "mock";
  status: "ready" | "partial" | "preview";
  message: string | null;
  provider?: "official" | "apify" | "public" | "mock";
};

export type PlatformContentBatch = {
  profile: EngagementProfile;
  followersCount: number;
  contents: EngagementContent[];
  source: PlatformContentSource;
};

export type OfficialPlatformContentFetcher = (input: {
  profile: EngagementProfile;
  connection: PlatformContentConnection;
  limit: number;
}) => Promise<Pick<PlatformContentBatch, "followersCount" | "contents">>;

export type GetLatestPlatformContentOptions = {
  connection?: PlatformContentConnection;
  fetchOfficial?: OfficialPlatformContentFetcher;
  now?: Date;
};

async function publicBatch(profile: EngagementProfile, now?: Date): Promise<PlatformContentBatch> {
  return { profile, ...(await getLatestPublicContent(profile, now)) };
}

async function configuredPublicBatch(profile: EngagementProfile, now?: Date): Promise<PlatformContentBatch> {
  if (isApifyConfigured()) {
    try {
      const apifyBatch = await getLatestApifyContent(profile, now);
      if (apifyBatch) return { profile, ...apifyBatch };
    } catch {
      // Keep the link-only flow usable when an Actor is unavailable or times out.
    }
  }

  const fallback = await publicBatch(profile, now);
  return {
    ...fallback,
    source: {
      ...fallback.source,
      message: isApifyConfigured()
        ? `Apify belum mengembalikan data; ${fallback.source.message || "crawl publik dipakai sebagai fallback."}`
        : fallback.source.message,
    },
  };
}

function normalizeOfficialContents(profile: EngagementProfile, contents: readonly EngagementContent[]) {
  return contents
    .filter((content) => content.platform === profile.platform)
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
    .slice(0, LATEST_CONTENT_LIMIT)
    .map((content) => ({
      ...content,
      unavailableFields: [...new Set(content.unavailableFields)],
    }));
}

/**
 * Mengambil paling banyak 20 konten terbaru melalui adapter API resmi platform.
 * Adapter menerima token yang sudah disimpan server dan wajib mengembalikan
 * data dalam kontrak EngagementContent. Tanpa koneksi, layanan mencoba crawl
 * Apify dipakai untuk link-only jika token server tersedia. Tanpa token,
 * layanan mencoba crawl halaman publik dan memakai data preview jika metriknya tertutup.
 */
export async function getLatestPlatformContent(
  profile: EngagementProfile,
  options: GetLatestPlatformContentOptions = {},
): Promise<PlatformContentBatch> {
  const connection = options.connection;
  if (!connection || connection.status !== "connected" || !connection.accessToken) {
    return configuredPublicBatch(profile, options.now);
  }

  if (!options.fetchOfficial) {
    return configuredPublicBatch(profile, options.now);
  }

  try {
    const result = await options.fetchOfficial({ profile, connection, limit: LATEST_CONTENT_LIMIT });
    const contents = normalizeOfficialContents(profile, result.contents);
    return {
      profile,
      followersCount: Math.max(0, Math.trunc(result.followersCount)),
      contents,
      source: { mode: "official", status: "ready", message: null },
    };
  } catch {
    return configuredPublicBatch(profile, options.now);
  }
}
