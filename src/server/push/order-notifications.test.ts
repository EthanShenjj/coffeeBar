import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  send: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => ({ devicePushToken: { findMany: mocks.findMany, updateMany: mocks.updateMany } }) }));
vi.mock("@/server/push/apns", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/push/apns")>()),
  sendApnsNotification: mocks.send,
}));

import { notifyOrderStatus } from "@/server/push/order-notifications";

const env = {
  APNS_TEAM_ID: "TEAM123456", APNS_KEY_ID: "KEY1234567",
  APNS_PRIVATE_KEY_BASE64: Buffer.from("-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----").toString("base64"),
  APNS_BUNDLE_ID: "com.coffeebar.app", APNS_ENVIRONMENT: "development",
};

describe("order push notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables an invalid APNs token without exposing it to logs", async () => {
    mocks.findMany.mockResolvedValue([{ id: "push-1", token: "sensitive-device-token" }]);
    mocks.send.mockResolvedValue({ ok: false, status: 410, reason: "Unregistered", invalidToken: true });

    await expect(notifyOrderStatus({
      userId: "user-1", orderId: "order-1", orderNumber: "CB0001", status: "READY",
    }, { env, logger: { warn: mocks.warn }, transport: { send: vi.fn() } })).resolves.toBeUndefined();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "push-1", userId: "user-1" },
      data: { disabledAt: expect.any(Date), disabledReason: "Unregistered" },
    });
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("sensitive-device-token");
  });

  it("contains transport errors and logs only safe metadata", async () => {
    mocks.findMany.mockResolvedValue([{ id: "push-1", token: "sensitive-device-token" }]);
    mocks.send.mockRejectedValue(new Error("private-key=secret sensitive-device-token"));

    await expect(notifyOrderStatus({
      userId: "user-1", orderId: "order-1", orderNumber: "CB0001", status: "PREPARING",
    }, { env, logger: { warn: mocks.warn }, transport: { send: vi.fn() } })).resolves.toBeUndefined();
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("sensitive-device-token");
  });

  it("queries at most ten active devices and sends with concurrency three", async () => {
    const tokens = Array.from({ length: 8 }, (_, index) => ({ id: `push-${index}`, token: `token-${index}` }));
    mocks.findMany.mockResolvedValue(tokens);
    let active = 0;
    let maximumActive = 0;
    mocks.send.mockImplementation(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return { ok: true, status: 200, invalidToken: false };
    });

    await notifyOrderStatus({
      userId: "user-1", orderId: "order-1", orderNumber: "CB0001", status: "READY",
    }, { env, logger: { warn: mocks.warn }, transport: { send: vi.fn() } });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", environment: "DEVELOPMENT", disabledAt: null },
      select: { id: true, token: true },
      take: 10,
    });
    expect(mocks.send).toHaveBeenCalledTimes(8);
    expect(maximumActive).toBe(3);
  });
});
