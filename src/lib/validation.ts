import { z } from "zod";
import { GIFT_CARD_RECHARGE_AMOUNTS } from "@/lib/gift-card";

const rechargeAmountSchema = z.number().refine(
  (amount) => Number.isInteger(amount)
    && GIFT_CARD_RECHARGE_AMOUNTS.some((allowedAmount) => allowedAmount === amount),
  "请选择有效的充值金额",
);

export const giftCardRechargeSchema = z.object({
  token: z.string().uuid(),
  amount: rechargeAmountSchema,
});

export const checkoutSchema = z.object({
  token: z.string().uuid(),
  kind: z.enum(["MENU", "SHOP"]),
  pickupName: z.string().trim().min(2).max(40),
  pickupPhone: z.string().regex(/^1\d{10}$/, "请输入 11 位手机号"),
  pickupAt: z.string().datetime(),
  note: z.string().trim().max(200).optional(),
  useGiftCard: z.boolean().default(false),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(20),
    optionIds: z.array(z.string()).max(8),
  })).min(1).max(30),
});
