import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmCheckout } from "@/actions/checkout";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  requireUser: vi.fn(),
  hasDatabase: vi.fn(),
  orderFindUnique: vi.fn(),
  productFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  updateTag: mocks.updateTag,
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({
  hasDatabase: mocks.hasDatabase,
  getDb: () => ({
    order: { findUnique: mocks.orderFindUnique },
    product: { findMany: mocks.productFindMany },
    $transaction: mocks.transaction,
  }),
}));

const checkoutInput = {
  token: "00000000-0000-4000-8000-000000000001",
  kind: "MENU",
  pickupName: "林墨",
  pickupPhone: "13800138000",
  pickupAt: "2026-07-16T08:00:00.000Z",
  useGiftCard: true,
  items: [{ productId: "product-1", quantity: 1, optionIds: [] }],
};

const now = new Date("2026-07-16T07:00:00.000Z");
const product = {
  id: "product-1",
  slug: "summer-box",
  name: "夏日礼盒",
  subtitle: "",
  description: "",
  channel: "MENU",
  category: "限定",
  basePrice: 12_800,
  imageUrl: "/summer-box.jpg",
  isAvailable: true,
  stock: 10,
  sortOrder: 1,
  createdAt: now,
  updatedAt: now,
  optionGroups: [],
};
const winningOrder = {
  id: "order-winning",
  orderNumber: "CB202607160001",
  checkoutToken: checkoutInput.token,
  userId: "user-1",
  kind: "MENU",
  status: "PAID",
  totalAmount: 12_800,
  pickupName: checkoutInput.pickupName,
  pickupPhone: checkoutInput.pickupPhone,
  pickupAt: new Date(checkoutInput.pickupAt),
  note: null,
  paidAt: now,
  createdAt: now,
  updatedAt: now,
  payment: {
    id: "payment-winning",
    orderId: "order-winning",
    amount: 12_800,
    giftCardAmount: 10_000,
    externalAmount: 2_800,
    status: "SUCCEEDED",
    providerRef: `SIM-${checkoutInput.token}`,
    paidAt: now,
  },
};

describe("confirmCheckout transaction retries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.hasDatabase.mockReturnValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.productFindMany.mockResolvedValue([product]);
  });

  it("returns the committed winning order after losing a concurrent checkout", async () => {
    mocks.orderFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winningOrder);
    mocks.transaction.mockRejectedValueOnce(
      new Error("Unique constraint failed on checkoutToken"),
    );

    const result = await confirmCheckout(checkoutInput);

    expect(result).toEqual({
      ok: true,
      orderId: "order-winning",
      orderNumber: "CB202607160001",
      totalAmount: 12_800,
      giftCardAmount: 10_000,
      externalAmount: 2_800,
      demo: false,
    });
  });

  it("hides unexpected transaction errors when no winning order exists", async () => {
    mocks.orderFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.transaction.mockRejectedValueOnce(
      new Error("Prisma connection failed: password=database-secret"),
    );

    const result = await confirmCheckout(checkoutInput);

    expect(result).toEqual({ ok: false, message: "支付未完成，请稍后重试" });
    expect(JSON.stringify(result)).not.toContain("database-secret");
  });
});
