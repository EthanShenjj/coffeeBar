import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  requireUser: vi.fn(),
  hasDatabase: vi.fn(),
  checkoutForUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, updateTag: mocks.updateTag }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({ hasDatabase: mocks.hasDatabase }));
vi.mock("@/server/services/checkout", () => ({
  checkoutForUser: mocks.checkoutForUser,
  sanitizeCheckoutError: (error: unknown) => error instanceof Error && error.message === "请先登录后再继续"
    ? error.message
    : "支付未完成，请稍后重试",
}));

import { confirmCheckout } from "@/actions/checkout";

const input = {
  token: "00000000-0000-4000-8000-000000000001",
  kind: "MENU",
  pickupName: "林墨",
  pickupPhone: "13800138000",
  pickupAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  useGiftCard: true,
  items: [{ productId: "product-1", quantity: 1, optionIds: [] }],
};

describe("confirmCheckout web wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabase.mockReturnValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.checkoutForUser.mockResolvedValue({
      created: true,
      result: {
        ok: true,
        orderId: "order-1",
        orderNumber: "CB1",
        totalAmount: 12800,
        giftCardAmount: 10000,
        externalAmount: 2800,
        demo: false,
      },
    });
  });

  it("authenticates on Web, delegates with the explicit user id, and revalidates after success", async () => {
    await expect(confirmCheckout(input)).resolves.toMatchObject({ ok: true, orderId: "order-1" });

    expect(mocks.checkoutForUser).toHaveBeenCalledWith("user-1", expect.objectContaining({ token: input.token }));
    expect(mocks.updateTag).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile/orders");
  });

  it("preserves the login prompt for signed-out customers", async () => {
    mocks.requireUser.mockRejectedValueOnce(new Error("请先登录后再继续"));
    await expect(confirmCheckout(input)).resolves.toEqual({ ok: false, message: "请先登录后再继续" });
  });

  it("does not revalidate an idempotent existing or concurrent winning order", async () => {
    mocks.checkoutForUser.mockResolvedValueOnce({
      created: false,
      result: {
        ok: true,
        orderId: "order-existing",
        orderNumber: "CB-EXISTING",
        totalAmount: 12800,
        giftCardAmount: 10000,
        externalAmount: 2800,
        demo: false,
      },
    });

    await expect(confirmCheckout(input)).resolves.toMatchObject({ ok: true, orderId: "order-existing" });
    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
