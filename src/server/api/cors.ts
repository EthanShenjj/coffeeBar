import { buildTrustedOrigins } from "@/lib/auth";

export type ApiEnvironment = {
  NEXT_PUBLIC_APP_URL?: string;
  BETTER_AUTH_URL?: string;
  MOBILE_ALLOWED_ORIGIN?: string;
};

export function corsHeadersForRequest(
  request: Request,
  env: ApiEnvironment = process.env as ApiEnvironment,
) {
  const origin = request.headers.get("origin");
  const allowed = origin === null || buildTrustedOrigins(env).includes(origin);
  const headers = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  });
  if (origin && allowed) headers.set("Access-Control-Allow-Origin", origin);
  return { allowed, headers };
}
