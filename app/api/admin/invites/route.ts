import { asc, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, signupInvites, user } from "@/db/schema";
import { getBootstrapAllowedEmails, isAdminEmail } from "@/lib/admin";
import { badRequest, forbidden, getApiSession, initials, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

const inviteSchema = z.object({ email: z.email().trim().toLowerCase() });

async function requireAdmin(request: Request) {
  const session = await getApiSession(request);
  if (!session) return { response: unauthorized() } as const;
  if (!isAdminEmail(session.user.email)) return { response: forbidden() } as const;
  return { session } as const;
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const [databaseInvites, members] = await Promise.all([
    db.select({
      id: signupInvites.id,
      email: signupInvites.email,
      createdAt: signupInvites.createdAt,
    }).from(signupInvites)
      .where(isNull(signupInvites.revokedAt))
      .orderBy(asc(signupInvites.email)),
    db.select({
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }).from(user),
  ]);
  const membersByEmail = new Map(members.map((member) => [member.email.toLowerCase(), member]));
  const dynamicEmails = new Set(databaseInvites.map((invite) => invite.email));
  const bootstrap = [...getBootstrapAllowedEmails()]
    .filter((email) => !dynamicEmails.has(email))
    .map((email) => {
      const member = membersByEmail.get(email);
      return {
        id: `environment:${email}`,
        email,
        createdAt: null,
        source: "environment" as const,
        removable: false,
        registered: Boolean(member),
        memberName: member?.name ?? null,
      };
    });
  const invites = databaseInvites.map((invite) => {
    const member = membersByEmail.get(invite.email);
    return {
      ...invite,
      source: "database" as const,
      removable: true,
      registered: Boolean(member),
      memberName: member?.name ?? null,
    };
  });

  return Response.json({ data: [...bootstrap, ...invites] });
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Masukkan alamat email yang valid", parsed.error.flatten());

  const email = parsed.data.email;
  const [invite] = await db.transaction(async (transaction) => {
    const rows = await transaction.insert(signupInvites).values({
      email,
      addedBy: access.session.user.id,
    }).onConflictDoUpdate({
      target: signupInvites.email,
      set: {
        addedBy: access.session.user.id,
        createdAt: new Date(),
        revokedAt: null,
      },
    }).returning();
    await transaction.insert(activityLogs).values({
      userId: access.session.user.id,
      actorName: access.session.user.name,
      actorInitials: initials(access.session.user.name),
      action: "menambahkan undangan anggota",
      details: email,
    });
    return rows;
  });

  return Response.json({ data: invite }, { status: 201 });
}
