import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authConfig: undefined as Record<string, unknown> | undefined,
  getSession: vi.fn(),
  bearer: vi.fn((options) => ({ id: "bearer", options })),
  nextCookies: vi.fn(() => ({ id: "next-cookies" })),
}));

vi.mock("better-auth/minimal", () => ({
  betterAuth: vi.fn((config) => {
    mocks.authConfig = config;
    return { api: { getSession: mocks.getSession } };
  }),
}));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: vi.fn(() => ({})) }));
vi.mock("better-auth/plugins", () => ({ bearer: mocks.bearer }));
vi.mock("better-auth/next-js", () => ({ nextCookies: mocks.nextCookies }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("react", () => ({ cache: (callback: unknown) => callback }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})), hasDatabase: vi.fn(() => true) }));
vi.mock("@/lib/email", () => ({ sendAuthEmail: vi.fn() }));

import {
  UnauthorizedError,
  buildTrustedOrigins,
  getAuth,
  getSessionFromHeaders,
  requireUserFromHeaders,
} from "@/lib/auth";

describe("buildTrustedOrigins", () => {
  it("normalizes configured web and mobile origins and filters invalid entries", () => {
    expect(buildTrustedOrigins({
      NEXT_PUBLIC_APP_URL: "https://coffee.example/path",
      BETTER_AUTH_URL: "https://auth.example/api/auth",
      MOBILE_ALLOWED_ORIGIN: " https://preview.example/path ,not-a-url, ,capacitor://other ",
    })).toEqual([
      "https://coffee.example",
      "https://auth.example",
      "capacitor://localhost",
      "https://preview.example",
      "capacitor://other",
    ]);
  });

  it("requires explicit input instead of reading process environment implicitly", () => {
    expect(() => (buildTrustedOrigins as unknown as () => string[])()).toThrow();
  });
});

describe("request header authentication", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
  });

  it("passes the supplied request headers directly to Better Auth without React cache", async () => {
    const requestHeaders = new Headers({ authorization: "Bearer signed-token" });
    mocks.getSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await expect(getSessionFromHeaders(requestHeaders)).resolves.toEqual({ user: { id: "user-1" } });
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: requestHeaders });
  });

  it("throws a typed unauthorized error when the request has no session", async () => {
    mocks.getSession.mockResolvedValueOnce(null);

    await expect(requireUserFromHeaders(new Headers())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("enables signed bearer tokens, trusted origins, deletion, and keeps nextCookies last", () => {
    getAuth();

    expect((mocks.authConfig?.plugins as Array<{ id: string; options?: unknown }>)[0]).toEqual({
      id: "bearer",
      options: { requireSignature: true },
    });
    expect(mocks.authConfig).toMatchObject({
      user: { deleteUser: { enabled: true } },
    });
    expect((mocks.authConfig?.plugins as Array<{ id: string }>).map((plugin) => plugin.id)).toEqual([
      "bearer",
      "next-cookies",
    ]);
  });
});
