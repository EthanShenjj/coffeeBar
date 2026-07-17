import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), updateOrder: vi.fn(), notify: vi.fn(), revalidate: vi.fn(), updateTag: vi.fn(),
  after: vi.fn(), scheduled: undefined as undefined | (() => Promise<unknown> | unknown),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate, updateTag: mocks.updateTag }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ order: { update: mocks.updateOrder } }) }));
vi.mock("@/server/push/order-notifications", () => ({ notifyOrderStatus: mocks.notify }));

import { advanceOrder } from "@/actions/admin";

describe("advanceOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduled = undefined;
    mocks.after.mockImplementation((task: () => unknown) => { mocks.scheduled = task; });
  });

  it("schedules notification after the database update and returns without waiting for APNs", async () => {
    mocks.updateOrder.mockResolvedValue({ id: "order-1", userId: "user-1", orderNumber: "CB0001", status: "READY" });
    await advanceOrder("order-1", "READY");
    expect(mocks.updateOrder).toHaveBeenCalledWith({
      where: { id: "order-1" }, data: { status: "READY" },
      select: { id: true, userId: true, orderNumber: true, status: true },
    });
    expect(mocks.updateOrder.mock.invocationCallOrder[0]).toBeLessThan(mocks.after.mock.invocationCallOrder[0]);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.scheduled).toBeTypeOf("function");
    await mocks.scheduled?.();
    expect(mocks.notify).toHaveBeenCalledWith({ userId: "user-1", orderId: "order-1", orderNumber: "CB0001", status: "READY" });
  });

  it("contains a scheduled notification rejection after the order action returns", async () => {
    mocks.updateOrder.mockResolvedValue({ id: "order-1", userId: "user-1", orderNumber: "CB0001", status: "COMPLETED" });
    mocks.notify.mockRejectedValue(new Error("APNs unavailable"));
    await expect(advanceOrder("order-1", "COMPLETED")).resolves.toBeUndefined();
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin");
    await expect(mocks.scheduled?.()).resolves.toBeUndefined();
  });
});
