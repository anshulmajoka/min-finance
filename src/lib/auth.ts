import "server-only";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth/minimal";
import { createAuthMiddleware } from "better-auth/api";
import { getDb } from "@/lib/mongo";

export function isAuthDisabled() {
  return process.env.AUTH_DISABLED?.trim().toLowerCase() === "true";
}

export function getAllowedEmails() {
  const emails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    emails.length !== 2 ||
    new Set(emails).size !== 2 ||
    emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    throw new Error("ALLOWED_EMAILS must contain exactly two unique, valid email addresses.");
  }
  return emails;
}

let authPromise: ReturnType<typeof createAuth> | undefined;

async function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Set BETTER_AUTH_SECRET to a random value of at least 32 characters.");
  }
  const allowedEmails = getAllowedEmails();
  const db = await getDb();
  const secureCookies = process.env.NODE_ENV === "production";

  return betterAuth({
    appName: "Mint Finance",
    baseURL: process.env.BETTER_AUTH_URL,
    secret,
    database: mongodbAdapter(db),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    advanced: {
      useSecureCookies: secureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "lax",
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path === "/sign-in/email" &&
          !allowedEmails.includes(String(ctx.body?.email ?? "").trim().toLowerCase())
        ) {
          return ctx.json({ message: "Invalid email or password." }, { status: 401 });
        }
      }),
    },
    telemetry: { enabled: false },
  });
}

export function getAuth() {
  authPromise ??= createAuth().catch((error) => {
    authPromise = undefined;
    throw error;
  });
  return authPromise;
}
