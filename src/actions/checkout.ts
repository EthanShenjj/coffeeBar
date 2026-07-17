"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { PRODUCT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { hasDatabase } from "@/lib/db";
import { DEMO_PRODUCTS } from "@/lib/demo-data";
import { formatOrderNumber } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validation";
import { checkoutForUser, sanitizeCheckoutError, type CheckoutResult } from "@/server/services/checkout";

export type { CheckoutResult } from "@/server/services/checkout";

export async function confirmCheckout(raw: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "结算信息有误" };
  const input = parsed.data;

  if (!hasDatabase()) {
    if (input.useGiftCard) return { ok: false, message: "配置数据库后可使用购物卡" };
    const total = input.items.reduce((sum, item) => {
      const product = DEMO_PRODUCTS.find((entry) => entry.id === item.productId);
      if (!product || product.channel !== input.kind) return sum;
      const options = product.optionGroups.flatMap((group) => group.options);
      const delta = options.filter((option) => item.optionIds.includes(option.id)).reduce((acc, option) => acc + option.priceDelta, 0);
      return sum + (product.price + delta) * item.quantity;
    }, 0);
    if (!total) return { ok: false, message: "商品已失效，请重新选择" };
    return { ok: true, orderId: `demo-${input.token}`, orderNumber: formatOrderNumber(), totalAmount: total, giftCardAmount: 0, externalAmount: total, demo: true };
  }

  try {
    const user = await requireUser();
    const serviceResult = await checkoutForUser(user.id, input);
    if (serviceResult.created) {
      updateTag(PRODUCT_CATALOG_CACHE_TAG);
      for (const path of ["/profile", "/profile/orders", "/profile/gift-card", "/checkout", "/admin"]) revalidatePath(path);
    }
    return serviceResult.result;
  } catch (error) {
    return { ok: false, message: sanitizeCheckoutError(error) };
  }
}
