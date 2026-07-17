import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findDevice: vi.fn(),
  findToken: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
}));

const tx = {
  devicePushToken: {
    findUnique: vi.fn((args: { where: { userId_deviceId?: unknown; token?: string } }) =>
      args.where.token ? mocks.findToken(args) : mocks.findDevice(args)),
    create: mocks.create,
    update: mocks.update,
    deleteMany: mocks.deleteMany,
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
});
