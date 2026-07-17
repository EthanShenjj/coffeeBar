import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb, hasDatabase } from "@/lib/db";
import { sendAuthEmail } from "@/lib/email";

type OriginEnvironment = {
  NEXT_PUBLIC_APP_URL?: string;
  BETTER_AUTH_URL?: string;
  MOBILE_ALLOWED_ORIGIN?: string;
};

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    if (url.protocol === "capacitor:" && url.hostname) {
      return `capacitor://${url.host}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function buildTrustedOrigins(env: OriginEnvironment = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  MOBILE_ALLOWED_ORIGIN: process.env.MOBILE_ALLOWED_ORIGIN,
}) {
  const configured = [
    env.NEXT_PUBLIC_APP_URL,
    env.BETTER_AUTH_URL,
    "capacitor://localhost",
    ...(env.MOBILE_ALLOWED_ORIGIN?.split(",") ?? []),
  ];
  return [...new Set(configured.flatMap((value) => {
    if (!value) return [];
    const origin = normalizeOrigin(value);
    return origin ? [origin] : [];
  }))];
}

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";

  constructor(message = "请先登录后再继续") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function createAuth() {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET 未配置");
  return betterAuth({
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      trustedOrigins: buildTrustedOrigins(),
      database: prismaAdapter(getDb(), { provider: "postgresql" }),
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url }) => {
          await sendAuthEmail(user.email, "重置 CoffeeBar 密码", url);
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          await sendAuthEmail(user.email, "验证你的 CoffeeBar 邮箱", url);
        },
      },
      user: {
        deleteUser: { enabled: true },
        changeEmail: {
          enabled: true,
          updateEmailWithoutVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "true",
        },
        additionalFields: {
          role: { type: "string", defaultValue: "CUSTOMER", input: false },
        },
      },
      session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
      plugins: [bearer({ requireSignature: true }), nextCookies()],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  auth ??= createAuth();
  return auth;
}

const getSessionForRequest = cache(async () => {
  if (!hasDatabase() || !process.env.BETTER_AUTH_SECRET) return null;
  return getAuth().api.getSession({ headers: await headers() });
});

export function getSession() {
  return getSessionForRequest();
}

export function getSessionFromHeaders(requestHeaders: Headers) {
  if (!hasDatabase() || !process.env.BETTER_AUTH_SECRET) return Promise.resolve(null);
  return getAuth().api.getSession({ headers: requestHeaders });
}

export async function requireUserFromHeaders(requestHeaders: Headers) {
  const session = await getSessionFromHeaders(requestHeaders);
  if (!session) throw new UnauthorizedError();
  return session.user;
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("请先登录后再继续");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if ((user as typeof user & { role?: string }).role !== "ADMIN") {
    throw new Error("无管理员权限");
  }
  return user;
}
