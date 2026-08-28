import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authSchema, signupInvites } from "@/db/schema";
import { getBootstrapAllowedEmails } from "@/lib/admin";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  appName: "Ruang Riset",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/change-password": { window: 60 * 10, max: 5 },
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (!isProduction || context.path !== "/sign-up/email") return;
      const email = typeof context.body?.email === "string" ? context.body.email.trim().toLowerCase() : "";
      const isBootstrapAllowed = email ? getBootstrapAllowedEmails().has(email) : false;
      const [activeInvite] = email && !isBootstrapAllowed
        ? await db.select({ id: signupInvites.id })
          .from(signupInvites)
          .where(and(eq(signupInvites.email, email), isNull(signupInvites.revokedAt)))
          .limit(1)
        : [];
      if (!email || (!isBootstrapAllowed && !activeInvite)) {
        throw new APIError("FORBIDDEN", {
          message: "Pendaftaran hanya tersedia untuk email anggota yang telah disetujui.",
        });
      }
    }),
  },
});
