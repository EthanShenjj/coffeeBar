import { EventEmitter } from "node:events";
import { exportPKCS8, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { decodeJwt, decodeProtectedHeader } from "jose";
import {
  createApnsProviderToken,
  createApnsRequest,
  createNodeApnsTransport,
  getCachedApnsProviderToken,
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

  it("reuses provider JWTs, refreshes before expiry, and isolates configuration changes", async () => {
    const config = loadApnsConfig(environment({ APNS_TEAM_ID: "CACHE12345", APNS_KEY_ID: "CACHEKEY01" }));
    const issuedAt = new Date("2026-07-17T10:00:00.000Z");
    const first = await getCachedApnsProviderToken(config, issuedAt);
    const reused = await getCachedApnsProviderToken(config, new Date(issuedAt.getTime() + 49 * 60_000));
    const refreshed = await getCachedApnsProviderToken(config, new Date(issuedAt.getTime() + 50 * 60_000));
    const changed = await getCachedApnsProviderToken(
      { ...config, keyId: "CACHEKEY02" },
      new Date(issuedAt.getTime() + 51 * 60_000),
    );
    const afterClockRollback = await getCachedApnsProviderToken(config, new Date(issuedAt.getTime() - 60_000));

    expect(reused).toBe(first);
    expect(refreshed).not.toBe(first);
    expect(decodeProtectedHeader(changed).kid).toBe("CACHEKEY02");
    expect(decodeJwt(afterClockRollback).iat).toBe(Math.floor((issuedAt.getTime() - 60_000) / 1000));
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

function transportHarness(options: { requestThrows?: boolean } = {}) {
  const stream = Object.assign(new EventEmitter(), {
    setEncoding: vi.fn(), end: vi.fn(), close: vi.fn(), destroy: vi.fn(),
  });
  const client = Object.assign(new EventEmitter(), {
    request: options.requestThrows
      ? vi.fn(() => { throw new Error("device-token=secret"); })
      : vi.fn(() => stream),
    close: vi.fn(), destroy: vi.fn(),
  });
  let timeout: (() => void) | undefined;
  const cancelTimeout = vi.fn();
  const transport = createNodeApnsTransport({
    connect: vi.fn(() => client),
    scheduleTimeout: vi.fn((callback) => { timeout = callback; return 1; }),
    cancelTimeout,
  });
  return { transport, client, stream, cancelTimeout, fireTimeout: () => timeout?.() };
}

const transportRequest = {
  host: "api.sandbox.push.apple.com" as const,
  path: "/3/device/device-token",
  headers: { authorization: "bearer provider-token" },
  body: "{}",
  timeoutMs: 10_000,
};

describe("Node APNs HTTP/2 transport", () => {
  it("settles a successful response once and closes stream and session", async () => {
    const harness = transportHarness();
    const response = harness.transport.send(transportRequest);
    harness.stream.emit("response", { ":status": 200 });
    harness.stream.emit("data", "{}");
    harness.stream.emit("end");
    harness.stream.emit("error", new Error("late error"));

    await expect(response).resolves.toEqual({ status: 200, body: "{}" });
    expect(harness.cancelTimeout).toHaveBeenCalledOnce();
    expect(harness.stream.close).toHaveBeenCalledOnce();
    expect(harness.client.close).toHaveBeenCalledOnce();
  });

  it("still settles and closes the session if stream cleanup throws", async () => {
    const harness = transportHarness();
    harness.stream.close.mockImplementation(() => { throw new Error("cleanup secret"); });
    const response = harness.transport.send(transportRequest);
    harness.stream.emit("response", { ":status": 200 });
    expect(() => harness.stream.emit("end")).not.toThrow();
    await expect(response).resolves.toEqual({ status: 200, body: "" });
    expect(harness.client.close).toHaveBeenCalledOnce();
  });

  it("sanitizes a synchronous request failure and destroys the session", async () => {
    const harness = transportHarness({ requestThrows: true });
    const response = harness.transport.send(transportRequest);
    await expect(response).rejects.toThrow("APNs transport failed");
    await expect(response).rejects.not.toThrow("secret");
    expect(harness.client.destroy).toHaveBeenCalledOnce();
  });

  it("times out once and destroys both stream and session", async () => {
    const harness = transportHarness();
    const response = harness.transport.send(transportRequest);
    harness.fireTimeout();
    harness.stream.emit("end");
    await expect(response).rejects.toThrow("APNs transport failed");
    expect(harness.stream.destroy).toHaveBeenCalledOnce();
    expect(harness.client.destroy).toHaveBeenCalledOnce();
  });

  it.each(["session", "stream"] as const)("contains a %s error and closes resources once", async (source) => {
    const harness = transportHarness();
    const response = harness.transport.send(transportRequest);
    (source === "session" ? harness.client : harness.stream).emit("error", new Error("private-key=secret"));
    harness.stream.emit("end");
    await expect(response).rejects.toThrow("APNs transport failed");
    expect(harness.stream.destroy).toHaveBeenCalledOnce();
    expect(harness.client.destroy).toHaveBeenCalledOnce();
  });
});
