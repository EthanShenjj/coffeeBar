import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(), orderFindFirst: vi.fn(),
  announcementFindMany: vi.fn(), announcementFindFirst: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    order: { findMany: mocks.orderFindMany, findFirst: mocks.orderFindFirst },
    announcement: { findMany: mocks.announcementFindMany, findFirst: mocks.announcementFindFirst },
  }),
}));

import {
  getAnnouncementForUser, getAnnouncementsForUser, getOrderForUser, getOrdersForUser,
} from "@/server/services/customer-reads";

describe("customer-owned wire reads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an allowlisted order summary without ownership or idempotency secrets", async () => {
    mocks.orderFindMany.mockResolvedValueOnce([{
      id: "order-1", orderNumber: "CB1", status: "PAID", totalAmount: 12800,
      createdAt: new Date("2026-07-17T00:00:00.000Z"), userId: "user-1", checkoutToken: "secret",
      items: [{ productName: "拿铁", quantity: 1, productId: "internal" }],
    }]);

    await expect(getOrdersForUser("user-1")).resolves.toEqual([{
      id: "order-1", orderNumber: "CB1", status: "PAID", totalAmount: 12800,
      createdAt: "2026-07-17T00:00:00.000Z", items: [{ productName: "拿铁", quantity: 1 }],
    }]);
    expect(mocks.orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" }, select: expect.any(Object) }));
  });

  it("returns an allowlisted owned detail without userId, checkoutToken, payment, or providerRef", async () => {
    mocks.orderFindFirst.mockResolvedValueOnce({
      id: "order-1", orderNumber: "CB1", kind: "MENU", status: "PAID", totalAmount: 12800,
      pickupName: "林墨", pickupPhone: "13800138000", pickupAt: new Date("2026-07-17T01:00:00.000Z"),
      note: null, paidAt: new Date("2026-07-17T00:00:00.000Z"), createdAt: new Date("2026-07-17T00:00:00.000Z"),
      userId: "user-1", checkoutToken: "secret", payment: { providerRef: "secret-provider" },
      items: [{ id: "item-1", productId: "product-1", productName: "拿铁", productImage: "/latte.jpg", category: "咖啡", unitPrice: 12800, quantity: 1, options: [], subtotal: 12800 }],
    });

    const detail = await getOrderForUser("user-1", "order-1");
    expect(detail).toEqual(expect.objectContaining({
      id: "order-1", pickupAt: "2026-07-17T01:00:00.000Z", paidAt: "2026-07-17T00:00:00.000Z",
    }));
    expect(JSON.stringify(detail)).not.toMatch(/userId|checkoutToken|providerRef|payment/);
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "order-1", userId: "user-1" }, select: expect.any(Object) }));
  });

  it.each(["missing", "foreign"])("returns null for %s orders", async () => {
    mocks.orderFindFirst.mockResolvedValueOnce(null);
    await expect(getOrderForUser("user-1", "order-foreign")).resolves.toBeNull();
  });

  it("projects announcement summaries without receipt IDs or persistence fields", async () => {
    mocks.announcementFindMany.mockResolvedValueOnce([{
      id: "announcement-1", title: "Title", summary: "Summary",
      publishedAt: new Date("2026-07-17T00:00:00.000Z"), createdAt: new Date("2026-07-16T00:00:00.000Z"),
      receipts: [{ id: "secret-receipt" }], content: "not-needed",
    }]);

    const result = await getAnnouncementsForUser("user-1");
    expect(result).toEqual([{ id: "announcement-1", title: "Title", summary: "Summary", date: "2026-07-17", read: true }]);
    expect(JSON.stringify(result)).not.toMatch(/receipt|content|publishedAt|createdAt/);
  });

  it("projects visible announcement detail without receipt IDs", async () => {
    mocks.announcementFindFirst.mockResolvedValueOnce({
      id: "announcement-1", title: "Title", summary: "Summary", content: "Content", coverUrl: null,
      publishedAt: new Date("2026-07-17T00:00:00.000Z"), createdAt: new Date("2026-07-16T00:00:00.000Z"),
      receipts: [{ id: "secret-receipt" }],
    });

    const result = await getAnnouncementForUser("user-1", "announcement-1");
    expect(result).toEqual({
      id: "announcement-1", title: "Title", summary: "Summary", content: "Content", coverUrl: null,
      publishedAt: "2026-07-17T00:00:00.000Z", createdAt: "2026-07-16T00:00:00.000Z", read: true,
    });
    expect(JSON.stringify(result)).not.toContain("secret-receipt");
  });
});
