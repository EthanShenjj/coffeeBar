"use server";

import { revalidatePath, updateTag } from "next/cache";
import { PRODUCT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { checkoutSchema } from "@/lib/validation";
import { DEMO_PRODUCTS } from "@/lib/demo-data";
import { formatOrderNumber } from "@/lib/utils";
import { getDb, hasDatabase } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { reserveGiftCardPayment } from "@/lib/gift-card-service";

export type CheckoutResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      totalAmount: number;
      giftCardAmount: number;
      externalAmount: number;
      demo: boolean;
    }
  | { ok: false; message: string };

type ExistingCheckoutOrder = {
  id: string;
  orderNumber: string;
  userId: string;
  totalAmount: number;
  payment: {
    giftCardAmount: number;
    externalAmount: number;
  } | null;
};

function resultFromExistingOrder(
  order: ExistingCheckoutOrder,
  userId: string,
): CheckoutResult {
  if (order.userId !== userId) {
    return { ok: false, message: "结算令牌不可用" };
  }
  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    giftCardAmount: order.payment?.giftCardAmount ?? 0,
    externalAmount: order.payment?.externalAmount ?? order.totalAmount,
    demo: false,
  };
}

const checkoutErrorMessages = new Set([
  "购物卡余额已变化，请重试支付",
  "餐饮与商店商品不能混合结算",
  "商品规格已变化，请重新选择",
]);

function checkoutErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "支付未完成，请稍后重试";
  if (checkoutErrorMessages.has(error.message)
    || /^请选择.+$/u.test(error.message)
    || /^.+选择数量超出限制$/u.test(error.message)
    || /^.+库存不足$/u.test(error.message)) {
    return error.message;
  }
  return "支付未完成，请稍后重试";
}

export async function confirmCheckout(raw: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "结算信息有误" };
  const input = parsed.data;

  if (!hasDatabase()) {
    if (input.useGiftCard) {
      return { ok: false, message: "配置数据库后可使用购物卡" };
    }
    const total = input.items.reduce((sum, item) => {
      const product = DEMO_PRODUCTS.find((entry) => entry.id === item.productId);
      if (!product || product.channel !== input.kind) return sum;
      const options = product.optionGroups.flatMap((group) => group.options);
      const delta = options.filter((option) => item.optionIds.includes(option.id)).reduce((acc, option) => acc + option.priceDelta, 0);
      return sum + (product.price + delta) * item.quantity;
    }, 0);
    if (!total) return { ok: false, message: "商品已失效，请重新选择" };
    return {
      ok: true,
      orderId: `demo-${input.token}`,
      orderNumber: formatOrderNumber(),
      totalAmount: total,
      giftCardAmount: 0,
      externalAmount: total,
      demo: true,
    };
  }

  try {
    const user = await requireUser();
    const db = getDb();
    const existing = await db.order.findUnique({
      where: { checkoutToken: input.token },
      include: { payment: true },
    });
    if (existing) {
      return resultFromExistingOrder(existing, user.id);
    }

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await db.product.findMany({
      where: { id: { in: productIds }, isAvailable: true },
      include: { optionGroups: { include: { options: { where: { isAvailable: true } } } } },
    });
    if (products.length !== productIds.length) return { ok: false, message: "部分商品已下架，请刷新购物车" };

    const snapshots = input.items.map((line) => {
      const product = products.find((entry) => entry.id === line.productId)!;
      if (product.channel !== input.kind) throw new Error("餐饮与商店商品不能混合结算");
      const selected = product.optionGroups.flatMap((group) => {
        const options = group.options.filter((option) => line.optionIds.includes(option.id));
        if (group.isRequired && options.length < group.minSelect) throw new Error(`请选择${group.name}`);
        if (options.length > group.maxSelect) throw new Error(`${group.name}选择数量超出限制`);
        return options;
      });
      const allowedIds = new Set(selected.map((option) => option.id));
      if (line.optionIds.some((id) => !allowedIds.has(id))) throw new Error("商品规格已变化，请重新选择");
      const unitPrice = product.basePrice + selected.reduce((sum, option) => sum + option.priceDelta, 0);
      return {
        product,
        quantity: line.quantity,
        unitPrice,
        subtotal: unitPrice * line.quantity,
        options: selected.map((option) => ({ id: option.id, name: option.name, priceDelta: option.priceDelta })),
      };
    });
    const totalAmount = snapshots.reduce((sum, item) => sum + item.subtotal, 0);
    const now = new Date();

    let transactionResult;
    try {
      transactionResult = await db.$transaction(async (tx) => {
        for (const item of snapshots) {
          if (item.product.stock !== null) {
            const updated = await tx.product.updateMany({
              where: { id: item.product.id, stock: { gte: item.quantity }, isAvailable: true },
              data: { stock: { decrement: item.quantity } },
            });
            if (updated.count !== 1) throw new Error(`${item.product.name}库存不足`);
          }
        }
        const split = await reserveGiftCardPayment(tx, {
          userId: user.id,
          totalAmount,
          useGiftCard: input.useGiftCard,
        });
        const order = await tx.order.create({
          data: {
            orderNumber: formatOrderNumber(now),
            checkoutToken: input.token,
            userId: user.id,
            kind: input.kind,
            totalAmount,
            pickupName: input.pickupName,
            pickupPhone: input.pickupPhone,
            pickupAt: new Date(input.pickupAt),
            note: input.note,
            paidAt: now,
            items: {
              create: snapshots.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                productImage: item.product.imageUrl,
                category: item.product.category,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                options: item.options,
                subtotal: item.subtotal,
              })),
            },
            payment: {
              create: {
                amount: totalAmount,
                giftCardAmount: split.giftCardAmount,
                externalAmount: split.externalAmount,
                providerRef: split.externalAmount > 0 ? `SIM-${input.token}` : null,
                paidAt: now,
              },
            },
          },
        });
        if (split.giftCardAmount > 0 && split.accountId) {
          await tx.giftCardTransaction.create({
            data: {
              accountId: split.accountId,
              type: "PURCHASE",
              amount: -split.giftCardAmount,
              reference: `PURCHASE:${input.token}`,
              orderId: order.id,
            },
          });
        }
        return { order, split };
      });
    } catch (transactionError) {
      const winningOrder = await db.order.findUnique({
        where: { checkoutToken: input.token },
        include: { payment: true },
      });
      if (winningOrder) {
        return resultFromExistingOrder(winningOrder, user.id);
      }
      throw transactionError;
    }
    const { order, split } = transactionResult;
    updateTag(PRODUCT_CATALOG_CACHE_TAG);
    revalidatePath("/profile");
    revalidatePath("/profile/orders");
    revalidatePath("/profile/gift-card");
    revalidatePath("/checkout");
    revalidatePath("/admin");
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount,
      giftCardAmount: split.giftCardAmount,
      externalAmount: split.externalAmount,
      demo: false,
    };
  } catch (error) {
    return { ok: false, message: checkoutErrorMessage(error) };
  }
}
