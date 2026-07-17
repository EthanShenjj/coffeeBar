import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), hasDatabase: vi.fn(), getOrdersForUser: vi.fn(), getAnnouncementsForUser: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(), hasDatabase: mocks.hasDatabase }));
vi.mock("@/server/services/orders", () => ({ getOrdersForUser: mocks.getOrdersForUser }));
vi.mock("@/server/services/announcements", () => ({ getAnnouncementsForUser: mocks.getAnnouncementsForUser }));
vi.mock("@/server/services/profiles", () => ({ getAccountProfileForUser: vi.fn(), getProfileDashboardForUser: vi.fn() }));

import { getAnnouncements, getOrders } from "@/lib/dashboard";

describe("dashboard Web projections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(null);
    mocks.hasDatabase.mockReturnValue(false);
  });

  it("keeps demo announcement dates in the web presentation format", async () => {
    await expect(getAnnouncements()).resolves.toMatchObject([
      { id: "a1", date: "07.12" }, { id: "a2", date: "07.08" }, { id: "a3", date: "06.28" },
    ]);
  });

  it("maps announcement wire dates back to localized Web display dates", async () => {
    mocks.hasDatabase.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getAnnouncementsForUser.mockResolvedValueOnce([{ id: "a1", title: "Title", summary: "Summary", date: "2026-07-17", read: false }]);
    await expect(getAnnouncements()).resolves.toEqual([{ id: "a1", title: "Title", summary: "Summary", date: "07.17", read: false }]);
  });

  it("maps order wire timestamps back to legacy Date objects", async () => {
    mocks.hasDatabase.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getOrdersForUser.mockResolvedValueOnce([{
      id: "order-1", orderNumber: "CB1", status: "PAID", totalAmount: 12800,
      createdAt: "2026-07-17T00:00:00.000Z", items: [{ productName: "拿铁", quantity: 1 }],
    }]);
    const orders = await getOrders();
    expect(orders[0]?.createdAt).toEqual(new Date("2026-07-17T00:00:00.000Z"));
  });
});
