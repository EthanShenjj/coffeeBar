import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(async () => new Response(JSON.stringify({ session: null }), { headers: { "Content-Type": "application/json" } })),
  post: vi.fn(async () => new Response(JSON.stringify({ user: { id: "u1" } }), { headers: { "Content-Type": "application/json", "set-auth-token": "token" } })),
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({ GET: mocks.get, POST: mocks.post })),
}));
vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(() => ({})),
  buildTrustedOrigins: (env: { NEXT_PUBLIC_APP_URL?: string; BETTER_AUTH_URL?: string; MOBILE_ALLOWED_ORIGIN?: string }) => [
    "capacitor://localhost",
    env.NEXT_PUBLIC_APP_URL,
    env.BETTER_AUTH_URL,
    ...(env.MOBILE_ALLOWED_ORIGIN?.split(",") ?? []),
  ].filter(Boolean),
}));

import { GET, OPTIONS, POST } from "./route";

describe("Better Auth strict CORS", () => {
  beforeEach(() => {
    mocks.get.mockClear();
    mocks.post.mockClear();
    process.env.NEXT_PUBLIC_APP_URL = "https://coffee.example";
    process.env.MOBILE_ALLOWED_ORIGIN = "capacitor://localhost";
  });

  it("allows mobile JSON and bearer preflight and exposes the auth token", async () => {
    const preflight = await OPTIONS(new Request("https://coffee.example/api/auth/sign-in/email", {
      method: "OPTIONS",
      headers: { origin: "capacitor://localhost", "access-control-request-headers": "authorization,content-type" },
    }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");

    const response = await POST(new Request("https://coffee.example/api/auth/sign-in/email", {
      method: "POST", headers: { origin: "capacitor://localhost", "content-type": "application/json" }, body: "{}",
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("set-auth-token");
    expect(await response.json()).toEqual({ user: { id: "u1" } });
  });

  it("rejects an unknown origin without invoking Better Auth or wrapping an API envelope", async () => {
    const response = await GET(new Request("https://coffee.example/api/auth/get-session", { headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "不允许的请求来源" });
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("keeps same-origin Web requests working without an Origin header", async () => {
    const response = await GET(new Request("https://coffee.example/api/auth/get-session"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toContain("Origin");
  });
});
