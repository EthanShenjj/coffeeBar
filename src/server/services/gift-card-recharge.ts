import { getDb } from "@/lib/db";
import { creditGiftCard } from "@/lib/gift-card-service";
import { giftCardRechargeSchema } from "@/lib/validation";

export type GiftCardRechargeResult = { ok: true; balance: number; idempotent: boolean } | { ok: false; message: string };

export async function rechargeGiftCardForUser(userId: string, raw: unknown): Promise<GiftCardRechargeResult> {
  const parsed = giftCardRechargeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "请选择有效的充值金额" };
  try {
    const result = await getDb().$transaction((tx) => creditGiftCard(tx, {
      userId,
      amount: parsed.data.amount,
      reference: `RECHARGE:${parsed.data.token}`,
    }));
    return { ok: true, balance: result.balance, idempotent: result.duplicate };
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === "充值令牌不可用" ? error.message : "充值失败，请稍后重试" };
  }
}
