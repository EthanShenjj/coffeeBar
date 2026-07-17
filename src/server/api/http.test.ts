import { describe, expect, it } from "vitest";
import { z } from "zod";
import { UnauthorizedError } from "@/lib/auth";
import { ServiceNotFoundError } from "@/server/services/errors";
import {
  ApiConflictError,
  ApiServiceUnavailableError,
  ApiOutputValidationError,
  assertCustomerDatabaseAvailable,
  apiErrorResponse,
  apiSuccessResponse,
  corsHeadersForRequest,
  handleOptions,
  mapApiError,
  parseJson,
  validateApiOutput,
} from "@/server/api/http";

const env = {
  NEXT_PUBLIC_APP_URL: "https://coffee.example/app",
  BETTER_AUTH_URL: "https://auth.example/path",
  MOBILE_ALLOWED_ORIGIN: "https://preview.example, https://second.example/path",
};

describe("customer API HTTP helpers", () => {
  it.each([
    "https://coffee.example",
    "https://auth.example",
    "https://preview.example",
    "https://second.example",
    "capacitor://localhost",
  ])("echoes the exact allowed origin %s", (origin) => {
    const result = corsHeadersForRequest(new Request("https://api.example/api/v1/catalog", { headers: { origin } }), env);
    expect(result.allowed).toBe(true);
    expect(result.headers.get("access-control-allow-origin")).toBe(origin);
    expect(result.headers.get("vary")).toBe("Origin");
    expect(result.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(result.headers.get("access-control-allow-headers")).toBe("Authorization, Content-Type");
  });

  it("rejects lookalike origins while allowing requests without Origin", () => {
    expect(corsHeadersForRequest(new Request("https://api.example"), env).allowed).toBe(true);
    expect(corsHeadersForRequest(new Request("https://api.example", {
      headers: { origin: "https://coffee.example.evil.test" },
    }), env).allowed).toBe(false);
  });

  it("handles allowed and disallowed preflight requests", async () => {
    const allowed = handleOptions(new Request("https://api.example", {
      method: "OPTIONS", headers: { origin: "capacitor://localhost" },
    }), env);
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");

    const denied = handleOptions(new Request("https://api.example", {
      method: "OPTIONS", headers: { origin: "https://evil.test" },
    }), env);
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "不允许的请求来源" },
    });
  });

  it("wraps success data and prevents caching", async () => {
    const response = apiSuccessResponse({ value: 1 }, new Request("https://api.example"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: { value: 1 } });
  });

  it("maps known errors and never exposes unexpected messages", async () => {
    expect(mapApiError(new UnauthorizedError())).toMatchObject({ status: 401, error: { code: "UNAUTHORIZED" } });
    expect(mapApiError(new ServiceNotFoundError("订单不存在"))).toEqual({
      status: 404, error: { code: "NOT_FOUND", message: "订单不存在" },
    });
    expect(mapApiError(new ApiConflictError("库存不足"))).toEqual({
      status: 409, error: { code: "CONFLICT", message: "库存不足" },
    });
    const response = apiErrorResponse(new Error("postgres://secret@database"), new Request("https://api.example"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });

  it("maps Zod issues to stable field errors", () => {
    const error = z.object({ channel: z.enum(["MENU", "SHOP"]) }).safeParse({ channel: "ADMIN" }).error!;
    expect(mapApiError(error)).toEqual({
      status: 400,
      error: {
        code: "VALIDATION_ERROR",
        message: "请求参数无效",
        fieldErrors: { channel: [expect.any(String)] },
      },
    });
  });

  it("rejects malformed JSON and schema-invalid JSON", async () => {
    const schema = z.object({ amount: z.number().int().positive() });
    await expect(parseJson(new Request("https://api.example", { method: "POST", body: "{" }), schema))
      .rejects.toMatchObject({ name: "ApiValidationError" });
    await expect(parseJson(new Request("https://api.example", {
      method: "POST", body: JSON.stringify({ amount: -1 }),
    }), schema)).rejects.toBeInstanceOf(z.ZodError);
  });

  it("fails closed for production public APIs and all authenticated APIs without a database", () => {
    expect(() => assertCustomerDatabaseAvailable({ available: false, nodeEnv: "production", access: "public" }))
      .toThrow(ApiServiceUnavailableError);
    expect(() => assertCustomerDatabaseAvailable({ available: false, nodeEnv: "development", access: "authenticated" }))
      .toThrow(ApiServiceUnavailableError);
    expect(() => assertCustomerDatabaseAvailable({ available: false, nodeEnv: "development", access: "public" }))
      .not.toThrow();
    expect(() => assertCustomerDatabaseAvailable({ available: false, nodeEnv: "test", access: "public" }))
      .toThrow(ApiServiceUnavailableError);
    expect(() => assertCustomerDatabaseAvailable({ available: false, nodeEnv: "preview", access: "public" }))
      .toThrow(ApiServiceUnavailableError);
    expect(() => assertCustomerDatabaseAvailable({ available: true, nodeEnv: "production", access: "authenticated" }))
      .not.toThrow();
  });

  it("validates adapter output without misreporting server data as a client error", () => {
    const schema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) }).strict();
    expect(validateApiOutput(schema, { version: "1.2.3" })).toEqual({ version: "1.2.3" });
    let error: unknown;
    try {
      validateApiOutput(schema, { version: "database-secret" });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiOutputValidationError);
    expect(mapApiError(error)).toEqual({
      status: 500,
      error: { code: "INTERNAL_ERROR", message: "服务器暂时无法处理请求" },
    });
    expect(JSON.stringify(mapApiError(error))).not.toContain("database-secret");
  });
});
