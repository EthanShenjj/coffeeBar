import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb, hasDatabase } from "@/lib/db";
import { sendAuthEmail } from "@/lib/email";

function createAuth() {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET 未配置");
  return betterAuth({
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
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
        changeEmail: {
          enabled: true,
          updateEmailWithoutVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "true",
        },
        additionalFields: {
          role: { type: "string", defaultValue: "CUSTOMER", input: false },
        },
      },
      session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
      plugins: [nextCookies()],
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
