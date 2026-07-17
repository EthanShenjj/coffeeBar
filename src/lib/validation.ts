import { z } from "zod";
export { checkoutInputSchema as checkoutSchema } from "@coffeebar/contracts";
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
