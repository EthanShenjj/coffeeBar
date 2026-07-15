import { z } from "zod";

export const checkoutSchema = z.object({
  token: z.string().uuid(),
  kind: z.enum(["MENU", "SHOP"]),
  pickupName: z.string().trim().min(2).max(40),
  pickupPhone: z.string().regex(/^1\d{10}$/, "请输入 11 位手机号"),
  pickupAt: z.string().datetime(),
  note: z.string().trim().max(200).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(20),
    optionIds: z.array(z.string()).max(8),
  })).min(1).max(30),
});
