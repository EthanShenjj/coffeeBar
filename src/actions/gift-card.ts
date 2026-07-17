"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { giftCardRechargeSchema } from "@/lib/validation";
import { rechargeGiftCardForUser, type GiftCardRechargeResult } from "@/server/services/gift-card-recharge";

export type { GiftCardRechargeResult } from "@/server/services/gift-card-recharge";

export async function rechargeGiftCard(raw: unknown): Promise<GiftCardRechargeResult> {
  const parsed = giftCardRechargeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "请选择有效的充值金额" };
  if (!hasDatabase()) return { ok: false, message: "购物卡充值需要配置数据库" };

  try {
    const user = await requireUser();
    const result = await rechargeGiftCardForUser(user.id, parsed.data);
    if (result.ok) for (const path of ["/profile", "/profile/gift-card", "/checkout"]) revalidatePath(path);
    return result;
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === "充值令牌不可用" ? error.message : "充值失败，请稍后重试" };
  }
}
