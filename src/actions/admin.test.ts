import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), updateOrder: vi.fn(), notify: vi.fn(), revalidate: vi.fn(), updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate, updateTag: mocks.updateTag }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ order: { update: mocks.updateOrder } }) }));
vi.mock("@/server/push/order-notifications", () => ({ notifyOrderStatus: mocks.notify }));

import { advanceOrder } from "@/actions/admin";

describe("advanceOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends an order-status notification only after the database update commits", async () => {
    mocks.updateOrder.mockResolvedValue({ id: "order-1", userId: "user-1", orderNumber: "CB0001", status: "READY" });
    await advanceOrder("order-1", "READY");
    expect(mocks.updateOrder).toHaveBeenCalledWith({
      where: { id: "order-1" }, data: { status: "READY" },
      select: { id: true, userId: true, orderNumber: true, status: true },
    });
    expect(mocks.updateOrder.mock.invocationCallOrder[0]).toBeLessThan(mocks.notify.mock.invocationCallOrder[0]);
    expect(mocks.notify).toHaveBeenCalledWith({ userId: "user-1", orderId: "order-1", orderNumber: "CB0001", status: "READY" });
  });

  it("does not roll back an updated order when notification dispatch fails", async () => {
    mocks.updateOrder.mockResolvedValue({ id: "order-1", userId: "user-1", orderNumber: "CB0001", status: "COMPLETED" });
    mocks.notify.mockRejectedValue(new Error("APNs unavailable"));
    await expect(advanceOrder("order-1", "COMPLETED")).resolves.toBeUndefined();
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin");
  });
});
