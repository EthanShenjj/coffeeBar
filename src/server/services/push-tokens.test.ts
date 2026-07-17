import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findDevice: vi.fn(),
  findToken: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
}));

const tx = {
  devicePushToken: {
    findUnique: vi.fn((args: { where: { userId_deviceId?: unknown; token?: string } }) =>
      args.where.token ? mocks.findToken(args) : mocks.findDevice(args)),
    create: mocks.create,
    update: mocks.update,
    deleteMany: mocks.deleteMany,
    count: mocks.count,
  },
};

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    $transaction: mocks.transaction,
    devicePushToken: { deleteMany: mocks.deleteMany },
  }),
}));

import { registerPushTokenForUser, removePushTokenForUser } from "@/server/services/push-tokens";

describe("push-token ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  });

  it("registers a new device for the explicit user", async () => {
    const updatedAt = new Date("2026-07-17T10:00:00.000Z");
    mocks.findDevice.mockResolvedValue(null);
    mocks.findToken.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ updatedAt });

    await expect(registerPushTokenForUser("user-a", {
      deviceId: "iphone-a", token: "token-a", environment: "DEVELOPMENT",
    })).resolves.toEqual({ registered: true, updatedAt: updatedAt.toISOString() });
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "user-a", deviceId: "iphone-a", token: "token-a", environment: "DEVELOPMENT",
    }), select: { updatedAt: true } });
  });

  it("rotates the token only for the same owned device and re-enables it", async () => {
    const updatedAt = new Date("2026-07-17T11:00:00.000Z");
    mocks.findDevice.mockResolvedValue({ id: "row-1", userId: "user-a", token: "old-token" });
    mocks.findToken.mockResolvedValue(null);
    mocks.update.mockResolvedValue({ updatedAt });

    await registerPushTokenForUser("user-a", {
      deviceId: "iphone-a", token: "new-token", environment: "PRODUCTION",
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: expect.objectContaining({
        token: "new-token", environment: "PRODUCTION", disabledAt: null, disabledReason: null,
      }),
      select: { updatedAt: true },
    });
  });

  it("refuses to claim a token already owned by another user", async () => {
    mocks.findDevice.mockResolvedValue(null);
    mocks.findToken.mockResolvedValue({ id: "row-b", userId: "user-b", deviceId: "iphone-b" });

    await expect(registerPushTokenForUser("user-a", {
      deviceId: "iphone-a", token: "shared-token", environment: "DEVELOPMENT",
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("removes only the current user's matching device", async () => {
    mocks.deleteMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    await expect(removePushTokenForUser("user-a", "iphone-b")).resolves.toEqual({ removed: false });
    await expect(removePushTokenForUser("user-a", "iphone-a")).resolves.toEqual({ removed: true });
    expect(mocks.deleteMany).toHaveBeenNthCalledWith(1, { where: { userId: "user-a", deviceId: "iphone-b" } });
    expect(mocks.deleteMany).toHaveBeenNthCalledWith(2, { where: { userId: "user-a", deviceId: "iphone-a" } });
  });

  it("retries the entire serializable ownership check after P2034", async () => {
    const updatedAt = new Date("2026-07-17T12:00:00.000Z");
    mocks.transaction
      .mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => {
        await callback(tx);
        throw { code: "P2034", message: "transaction conflict" };
      })
      .mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.findDevice.mockResolvedValue(null);
    mocks.findToken.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ updatedAt });

    await expect(registerPushTokenForUser("user-a", {
      deviceId: "iphone-a", token: "token-a", environment: "DEVELOPMENT",
    })).resolves.toEqual({ registered: true, updatedAt: updatedAt.toISOString() });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.findDevice).toHaveBeenCalledTimes(2);
    expect(mocks.findToken).toHaveBeenCalledTimes(2);
  });

  it("maps exhausted P2034 retries to a stable conflict without internal details", async () => {
    mocks.transaction.mockRejectedValue({ code: "P2034", message: "postgres password=secret" });

    let caught: unknown;
    try {
      await registerPushTokenForUser("user-a", {
        deviceId: "iphone-a", token: "token-a", environment: "DEVELOPMENT",
      });
    } catch (error) {
      caught = error;
    }
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
    expect(caught).toMatchObject({ code: "CONFLICT", message: "设备绑定冲突，请重试" });
    expect(JSON.stringify(caught)).not.toContain("secret");
  });

  it("caps new active devices while allowing an existing device to rotate", async () => {
    mocks.findDevice.mockResolvedValueOnce(null);
    mocks.findToken.mockResolvedValue(null);
    mocks.count.mockResolvedValue(10);
    await expect(registerPushTokenForUser("user-a", {
      deviceId: "iphone-11", token: "token-11", environment: "PRODUCTION",
    })).rejects.toMatchObject({ code: "CONFLICT", message: "已达到推送设备数量上限" });
    expect(mocks.count).toHaveBeenCalledWith({ where: { userId: "user-a", disabledAt: null } });
    expect(mocks.create).not.toHaveBeenCalled();

    const updatedAt = new Date("2026-07-17T13:00:00.000Z");
    mocks.findDevice.mockResolvedValueOnce({ id: "row-1", userId: "user-a", token: "old-token" });
    mocks.update.mockResolvedValue({ updatedAt });
    await expect(registerPushTokenForUser("user-a", {
      deviceId: "iphone-a", token: "new-token", environment: "PRODUCTION",
    })).resolves.toMatchObject({ registered: true });
    expect(mocks.count).toHaveBeenCalledTimes(1);
  });

  it("does not let re-enabling a disabled device exceed the active-device cap", async () => {
    mocks.findDevice.mockResolvedValue({
      id: "row-disabled", userId: "user-a", token: "old-token", disabledAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    mocks.findToken.mockResolvedValue(null);
    mocks.count.mockResolvedValue(10);

    await expect(registerPushTokenForUser("user-a", {
      deviceId: "iphone-disabled", token: "new-token", environment: "PRODUCTION",
    })).rejects.toMatchObject({ code: "CONFLICT", message: "已达到推送设备数量上限" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
