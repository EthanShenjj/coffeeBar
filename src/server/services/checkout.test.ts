import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  outerProductFindMany: vi.fn(),
  txProductFindMany: vi.fn(),
  txProductUpdateMany: vi.fn(),
  txOrderCreate: vi.fn(),
  txGiftTransactionCreate: vi.fn(),
  transaction: vi.fn(),
  reserveGiftCardPayment: vi.fn(),
}));

const tx = {
  product: { findMany: mocks.txProductFindMany, updateMany: mocks.txProductUpdateMany },
  order: { create: mocks.txOrderCreate },
  giftCardTransaction: { create: mocks.txGiftTransactionCreate },
};
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    order: { findUnique: mocks.orderFindUnique },
    product: { findMany: mocks.outerProductFindMany },
    $transaction: mocks.transaction,
  }),
}));
vi.mock("@/lib/gift-card-service", () => ({ reserveGiftCardPayment: mocks.reserveGiftCardPayment }));

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
  id: "product-1", name: "夏日礼盒", channel: "MENU", category: "限定",
  basePrice: 12800, imageUrl: "/summer-box.jpg", stock: 10, optionGroups: [],
};
const winningOrder = {
  id: "order-winning", orderNumber: "CB202607160001", userId: "user-1", totalAmount: 12800,
  payment: { giftCardAmount: 10000, externalAmount: 2800 },
};
const writeConflict = { code: "P2034", message: "Transaction failed due to a write conflict" };

describe("checkoutForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.outerProductFindMany.mockResolvedValue([product]);
    mocks.txProductFindMany.mockResolvedValue([product]);
    mocks.txProductUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txOrderCreate.mockResolvedValue({ id: "order-new", orderNumber: "CB-NEW" });
    mocks.reserveGiftCardPayment.mockResolvedValue({ giftCardAmount: 10000, externalAmount: 2800, accountId: null });
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  });

  it("returns the owned winning order after losing a concurrent checkout", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winningOrder);
    mocks.transaction.mockRejectedValueOnce(new Error("Unique constraint failed"));
    await expect(checkoutForUser("user-1", input)).resolves.toEqual({
      created: false,
      result: { ok: true, orderId: "order-winning", orderNumber: "CB202607160001", totalAmount: 12800, giftCardAmount: 10000, externalAmount: 2800, demo: false },
    });
  });

  it("rejects another user's idempotent checkout token", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce({ ...winningOrder, userId: "user-2" });
    await expect(checkoutForUser("user-1", input)).resolves.toEqual({ created: false, result: { ok: false, message: "结算令牌不可用" } });
  });

  it("allowlists idempotency lookup fields and never reads providerRef", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(winningOrder);
    await checkoutForUser("user-1", input);

    expect(mocks.orderFindUnique).toHaveBeenCalledWith({
      where: { checkoutToken: input.token },
      select: {
        id: true, orderNumber: true, userId: true, totalAmount: true,
        payment: { select: { giftCardAmount: true, externalAmount: true } },
      },
    });
    expect(JSON.stringify(mocks.orderFindUnique.mock.calls[0])).not.toContain("providerRef");
  });

  it("does not leak unexpected database errors", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.transaction.mockRejectedValueOnce(new Error("password=database-secret"));
    const result = await checkoutForUser("user-1", input);
    expect(result).toEqual({ created: false, result: { ok: false, message: "支付未完成，请稍后重试" } });
    expect(JSON.stringify(result)).not.toContain("database-secret");
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("retries a P2034 conflict and succeeds on the next transaction attempt", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.transaction.mockRejectedValueOnce(writeConflict);

    await expect(checkoutForUser("user-1", input)).resolves.toMatchObject({
      created: true,
      result: { ok: true, orderId: "order-new" },
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it("returns a same-token winner between P2034 retry attempts", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winningOrder);
    mocks.transaction.mockRejectedValueOnce(writeConflict);

    await expect(checkoutForUser("user-1", input)).resolves.toEqual({
      created: false,
      result: { ok: true, orderId: "order-winning", orderNumber: "CB202607160001", totalAmount: 12800, giftCardAmount: 10000, externalAmount: 2800, demo: false },
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("stops after three P2034 attempts and returns a sanitized generic failure", async () => {
    mocks.orderFindUnique.mockResolvedValue(null);
    mocks.transaction.mockRejectedValue(writeConflict);

    await expect(checkoutForUser("user-1", input)).resolves.toEqual({
      created: false,
      result: { ok: false, message: "支付未完成，请稍后重试" },
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
    expect(mocks.orderFindUnique).toHaveBeenCalledTimes(4);
  });

  it("reads and prices products inside a serializable transaction", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null);
    await checkoutForUser("user-1", input);

    expect(mocks.outerProductFindMany).not.toHaveBeenCalled();
    expect(mocks.txProductFindMany).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.txOrderCreate).toHaveBeenCalledOnce();
  });

  it("does not commit an order when the transaction sees a stale unavailable product", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.txProductFindMany.mockResolvedValueOnce([]);

    await expect(checkoutForUser("user-1", input)).resolves.toEqual({
      created: false,
      result: { ok: false, message: "部分商品已下架，请刷新购物车" },
    });
    expect(mocks.txOrderCreate).not.toHaveBeenCalled();
    expect(mocks.reserveGiftCardPayment).not.toHaveBeenCalled();
  });

  it("marks only a newly committed order as created", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null);
    await expect(checkoutForUser("user-1", input)).resolves.toMatchObject({ created: true, result: { ok: true, orderId: "order-new" } });
  });
});
