import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  productFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    order: { findUnique: mocks.orderFindUnique },
    product: { findMany: mocks.productFindMany },
    $transaction: mocks.transaction,
  }),
}));

import { checkoutForUser } from "@/server/services/checkout";

const input = {
  token: "00000000-0000-4000-8000-000000000001",
  kind: "MENU",
  pickupName: "林墨",
  pickupPhone: "13800138000",
  pickupAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  useGiftCard: true,
  items: [{ productId: "product-1", quantity: 1, optionIds: [] }],
};
const product = {
  id: "product-1",
  name: "夏日礼盒",
  channel: "MENU",
  category: "限定",
  basePrice: 12800,
  imageUrl: "/summer-box.jpg",
  stock: 10,
  optionGroups: [],
};
const winningOrder = {
  id: "order-winning",
  orderNumber: "CB202607160001",
  userId: "user-1",
  totalAmount: 12800,
  payment: { giftCardAmount: 10000, externalAmount: 2800 },
};

describe("checkoutForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindMany.mockResolvedValue([product]);
  });

  it("returns the owned winning order after losing a concurrent checkout", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winningOrder);
    mocks.transaction.mockRejectedValueOnce(new Error("Unique constraint failed"));

    await expect(checkoutForUser("user-1", input)).resolves.toEqual({
      ok: true,
      orderId: "order-winning",
      orderNumber: "CB202607160001",
      totalAmount: 12800,
      giftCardAmount: 10000,
      externalAmount: 2800,
      demo: false,
    });
  });

  it("rejects another user's idempotent checkout token", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce({ ...winningOrder, userId: "user-2" });
    await expect(checkoutForUser("user-1", input)).resolves.toEqual({ ok: false, message: "结算令牌不可用" });
  });

  it("does not leak unexpected database errors", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.transaction.mockRejectedValueOnce(new Error("password=database-secret"));

    const result = await checkoutForUser("user-1", input);
    expect(result).toEqual({ ok: false, message: "支付未完成，请稍后重试" });
    expect(JSON.stringify(result)).not.toContain("database-secret");
  });
});
