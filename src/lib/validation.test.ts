import { describe, expect, it } from "vitest";
import { checkoutSchema, giftCardRechargeSchema } from "@/lib/validation";

const valid = { token: "a6236aeb-4e08-44f4-b9d4-c927219563af", kind: "MENU", pickupName: "林墨", pickupPhone: "13800138000", pickupAt: new Date(Date.now() + 3600000).toISOString(), items: [{ productId: "latte", quantity: 1, optionIds: [] }] };
describe("checkout validation", () => {
  it("accepts a valid pickup order", () => { expect(checkoutSchema.safeParse(valid).success).toBe(true); });
  it("defaults gift card use to false", () => { expect(checkoutSchema.parse(valid).useGiftCard).toBe(false); });
  it("rejects invalid phone numbers", () => { expect(checkoutSchema.safeParse({ ...valid, pickupPhone: "123" }).success).toBe(false); });
  it("rejects empty carts", () => { expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false); });
});

describe("gift card recharge validation", () => {
  const token = "a6236aeb-4e08-44f4-b9d4-c927219563af";

  it.each([10_000, 20_000, 30_000, 50_000])("accepts the supported amount %i", (amount) => {
    expect(giftCardRechargeSchema.safeParse({ token, amount }).success).toBe(true);
  });

  it.each([0, 9_999, 15_000, 50_001])("rejects the unsupported amount %i", (amount) => {
    expect(giftCardRechargeSchema.safeParse({ token, amount }).success).toBe(false);
  });

  it("uses the recharge amount message for fractional amounts", () => {
    const result = giftCardRechargeSchema.safeParse({ token, amount: 10_000.5 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("请选择有效的充值金额");
    }
  });
});
