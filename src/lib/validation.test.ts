import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validation";

const valid = { token: "a6236aeb-4e08-44f4-b9d4-c927219563af", kind: "MENU", pickupName: "林墨", pickupPhone: "13800138000", pickupAt: new Date(Date.now() + 3600000).toISOString(), items: [{ productId: "latte", quantity: 1, optionIds: [] }] };
describe("checkout validation", () => {
  it("accepts a valid pickup order", () => { expect(checkoutSchema.safeParse(valid).success).toBe(true); });
  it("rejects invalid phone numbers", () => { expect(checkoutSchema.safeParse({ ...valid, pickupPhone: "123" }).success).toBe(false); });
  it("rejects empty carts", () => { expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false); });
});
