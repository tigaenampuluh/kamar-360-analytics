import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "@/db";
import { authSchema } from "@/db/schema";

const isProduction = process.env.NODE_ENV === "production";
const allowedSignUpEmails = new Set(
  (process.env.ALLOWED_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

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
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (!isProduction || context.path !== "/sign-up/email") return;
      const email = typeof context.body?.email === "string" ? context.body.email.trim().toLowerCase() : "";
      if (!email || !allowedSignUpEmails.has(email)) {
        throw new APIError("FORBIDDEN", {
          message: "Pendaftaran hanya tersedia untuk email anggota yang telah disetujui.",
        });
      }
    }),
  },
});
