import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResetRequests, user } from "@/db/schema";
import { badRequest } from "@/lib/api";

export const runtime = "nodejs";

const requestSchema = z.object({ email: z.email().trim().toLowerCase() });
const genericMessage = "Permintaan berhasil dikirim. Jika email terdaftar, admin akan menerima permintaan Anda dan menyiapkan password sementara.";

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Masukkan alamat email yang valid.");

  const [member] = await db.select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, parsed.data.email))
    .limit(1);

  if (member) {
    await db.insert(passwordResetRequests)
      .values({ userId: member.id, email: member.email.toLowerCase() })
      .onConflictDoNothing();
  }

  return Response.json({ message: genericMessage });
}
