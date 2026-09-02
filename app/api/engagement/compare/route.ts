import { z } from "zod";
import { comparePublicProfiles } from "@/lib/services/engagement-public-profile-service";
import { normalizeEngagementProfileUrl } from "@/lib/services/engagement-profile-service";

export const runtime = "nodejs";

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

  const data = await comparePublicProfiles(profiles as NonNullable<typeof profiles[number]>[]);
  return Response.json({ data: { accounts: data, source: "public_fetch", message: "Aplikasi mencoba membaca metadata publik tanpa koneksi akun." } });
}
