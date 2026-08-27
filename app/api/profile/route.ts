import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, user } from "@/db/schema";
import { badRequest, getApiSession, initials, notFound, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  image: z.union([z.url(), z.literal(""), z.null()]).optional(),
}).refine((data) => Object.keys(data).length > 0, "No fields supplied");

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const [profile] = await db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }).from(user).where(eq(user.id, session.user.id)).limit(1);
  return profile ? Response.json({ data: profile }) : notFound("Profile");
}

export async function PATCH(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const parsed = updateProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid profile data", parsed.error.flatten());

  const profile = await db.transaction(async (transaction) => {
    const [updated] = await transaction.update(user).set({
      ...parsed.data,
      ...(parsed.data.image !== undefined ? { image: parsed.data.image || null } : {}),
      updatedAt: new Date(),
    }).where(eq(user.id, session.user.id)).returning({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    if (!updated) return null;
    await transaction.insert(activityLogs).values({
      userId: updated.id,
      actorName: updated.name,
      actorInitials: initials(updated.name),
      action: "memperbarui profil",
      details: updated.name,
    });
    return updated;
  });

  return profile ? Response.json({ data: profile }) : notFound("Profile");
}
