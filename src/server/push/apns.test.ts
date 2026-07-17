import { exportPKCS8, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { decodeJwt, decodeProtectedHeader } from "jose";
import {
  createApnsProviderToken,
  createApnsRequest,
  loadApnsConfig,
  sendApnsNotification,
  type ApnsTransport,
} from "@/server/push/apns";

let privateKeyBase64: string;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  privateKeyBase64 = Buffer.from(await exportPKCS8(privateKey)).toString("base64");
});

function environment(overrides: Record<string, string> = {}) {
  return {
    APNS_TEAM_ID: "TEAM123456",
    APNS_KEY_ID: "KEY1234567",
    APNS_PRIVATE_KEY_BASE64: privateKeyBase64,
    APNS_BUNDLE_ID: "com.coffeebar.app",
    APNS_ENVIRONMENT: "development",
    ...overrides,
  };
}

describe("APNs provider requests", () => {
  it("selects the sandbox and production hosts from validated config", () => {
    expect(loadApnsConfig(environment()).host).toBe("api.sandbox.push.apple.com");
    expect(loadApnsConfig(environment({ APNS_ENVIRONMENT: "production" })).host).toBe("api.push.apple.com");
    expect(() => loadApnsConfig(environment({ APNS_ENVIRONMENT: "staging", APNS_PRIVATE_KEY_BASE64: "private-secret" })))
      .toThrow("APNs configuration is invalid");
  });

  it("creates an ES256 provider JWT without embedding private material", async () => {
    const now = new Date("2026-07-17T10:00:00.000Z");
    const token = await createApnsProviderToken(loadApnsConfig(environment()), now);
    expect(decodeProtectedHeader(token)).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(decodeJwt(token)).toMatchObject({ iss: "TEAM123456", iat: Math.floor(now.getTime() / 1000) });
    expect(token).not.toContain(privateKeyBase64);
  });

  it("builds an order deep-link alert request with APNs headers", async () => {
    const config = loadApnsConfig(environment());
    const request = await createApnsRequest(config, "device-token", {
      orderId: "order-1", orderNumber: "CB0001", status: "READY",
    });
    expect(request.path).toBe("/3/device/device-token");
    expect(request.headers).toMatchObject({
      "apns-topic": "com.coffeebar.app", "apns-push-type": "alert", "apns-priority": "10",
    });
    expect(request.headers.authorization).toMatch(/^bearer /);
    expect(JSON.parse(request.body)).toMatchObject({
      orderId: "order-1", orderStatus: "READY", deepLink: "coffeebar://orders/order-1",
      aps: { sound: "default" },
    });
  });

  it("marks 410, BadDeviceToken, and Unregistered responses as invalid tokens", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ status: 410, body: '{"reason":"ExpiredProviderToken"}' })
      .mockResolvedValueOnce({ status: 400, body: '{"reason":"BadDeviceToken"}' })
      .mockResolvedValueOnce({ status: 400, body: '{"reason":"Unregistered"}' });
    const transport: ApnsTransport = { send };
    const config = loadApnsConfig(environment());

    await expect(sendApnsNotification(config, transport, "device-token", {
      orderId: "order-1", orderNumber: "CB0001", status: "READY",
    })).resolves.toMatchObject({ invalidToken: true });
    await expect(sendApnsNotification(config, transport, "device-token", {
      orderId: "order-1", orderNumber: "CB0001", status: "READY",
    })).resolves.toMatchObject({ invalidToken: true, reason: "BadDeviceToken" });
    await expect(sendApnsNotification(config, transport, "device-token", {
      orderId: "order-1", orderNumber: "CB0001", status: "READY",
    })).resolves.toMatchObject({ invalidToken: true, reason: "Unregistered" });
  });
});
