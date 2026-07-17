import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  announcementFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    order: { findMany: mocks.orderFindMany, findFirst: mocks.orderFindFirst },
    announcement: { findFirst: mocks.announcementFindFirst },
  }),
}));

import {
  getAnnouncementForUser,
  getOrderForUser,
  getOrdersForUser,
} from "@/server/services/customer-reads";

describe("customer-owned reads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always scopes the order list to the explicit user", async () => {
    mocks.orderFindMany.mockResolvedValueOnce([]);

    await getOrdersForUser("user-1");

    expect(mocks.orderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
    }));
  });

  it("returns an owned order detail", async () => {
    mocks.orderFindFirst.mockResolvedValueOnce({ id: "order-1", userId: "user-1" });

    await expect(getOrderForUser("user-1", "order-1")).resolves.toMatchObject({ id: "order-1" });
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order-1", userId: "user-1" },
    }));
  });

  it.each(["missing", "foreign"])("returns null for %s orders", async () => {
    mocks.orderFindFirst.mockResolvedValueOnce(null);
    await expect(getOrderForUser("user-1", "order-foreign")).resolves.toBeNull();
  });

  it("reads only published announcement detail and scopes the receipt to the user", async () => {
    mocks.announcementFindFirst.mockResolvedValueOnce(null);

    await getAnnouncementForUser("user-1", "announcement-1");

    expect(mocks.announcementFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "announcement-1", status: "PUBLISHED" }),
      include: { receipts: { where: { userId: "user-1" }, select: { id: true } } },
    }));
  });
});
