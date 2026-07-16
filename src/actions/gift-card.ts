"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getDb, hasDatabase } from "@/lib/db";
import { creditGiftCard } from "@/lib/gift-card-service";
import { giftCardRechargeSchema } from "@/lib/validation";

export type RechargeGiftCardResult =
  | { ok: true; balance: number }
  | { ok: false; message: string };

export async function rechargeGiftCard(raw: unknown): Promise<RechargeGiftCardResult> {
  const parsed = giftCardRechargeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "请选择有效的充值金额",
    };
  }
  if (!hasDatabase()) {
    return { ok: false, message: "购物卡充值需要数据库支持" };
  }

  try {
    const user = await requireUser();
    const result = await getDb().$transaction((tx) => creditGiftCard(tx, {
      userId: user.id,
      amount: parsed.data.amount,
      reference: `RECHARGE:${parsed.data.token}`,
    }));
    revalidatePath("/profile");
    revalidatePath("/profile/gift-card");
    revalidatePath("/checkout");
    return { ok: true, balance: result.balance };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "充值失败，请稍后重试",
    };
  }
}
