import { getDb } from "@/lib/db";
import { reserveGiftCardPayment } from "@/lib/gift-card-service";
import { formatOrderNumber } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validation";

export type CheckoutResult =
  | { ok: true; orderId: string; orderNumber: string; totalAmount: number; giftCardAmount: number; externalAmount: number; demo: boolean }
  | { ok: false; message: string };

type CheckoutSuccess = Extract<CheckoutResult, { ok: true }>;

export type CheckoutServiceResult =
  | { result: CheckoutSuccess; created: true }
  | { result: CheckoutResult; created: false };

function unchanged(result: CheckoutResult): CheckoutServiceResult {
  return { result, created: false };
}

type ExistingCheckoutOrder = {
  id: string;
  orderNumber: string;
  userId: string;
  totalAmount: number;
  payment: { giftCardAmount: number; externalAmount: number } | null;
};

const existingOrderSelect = {
  id: true,
  orderNumber: true,
  userId: true,
  totalAmount: true,
  payment: { select: { giftCardAmount: true, externalAmount: true } },
} as const;

function resultFromExistingOrder(order: ExistingCheckoutOrder, userId: string): CheckoutResult {
  if (order.userId !== userId) return { ok: false, message: "结算令牌不可用" };
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
  "请先登录后再继续",
  "购物卡余额已变化，请重试支付",
  "餐饮与商店商品不能混合结算",
  "商品规格已变化，请重新选择",
  "部分商品已下架，请刷新购物车",
]);

export function sanitizeCheckoutError(error: unknown) {
  if (!(error instanceof Error)) return "支付未完成，请稍后重试";
  if (checkoutErrorMessages.has(error.message)
    || /^请选择.+$/u.test(error.message)
    || /^.+选择数量超出限制$/u.test(error.message)
    || /^.+库存不足$/u.test(error.message)) return error.message;
  return "支付未完成，请稍后重试";
}

export async function checkoutForUser(userId: string, raw: unknown): Promise<CheckoutServiceResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return unchanged({ ok: false, message: parsed.error.issues[0]?.message ?? "结算信息有误" });
  const input = parsed.data;

  try {
    const db = getDb();
    const existing = await db.order.findUnique({ where: { checkoutToken: input.token }, select: existingOrderSelect });
    if (existing) return unchanged(resultFromExistingOrder(existing, userId));

    let transactionResult;
    try {
      transactionResult = await db.$transaction(async (tx) => {
        const productIds = [...new Set(input.items.map((item) => item.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, isAvailable: true },
          include: { optionGroups: { include: { options: { where: { isAvailable: true } } } } },
        });
        if (products.length !== productIds.length) throw new Error("部分商品已下架，请刷新购物车");

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
            product, quantity: line.quantity, unitPrice, subtotal: unitPrice * line.quantity,
            options: selected.map((option) => ({ id: option.id, name: option.name, priceDelta: option.priceDelta })),
          };
        });
        const totalAmount = snapshots.reduce((sum, item) => sum + item.subtotal, 0);
        const now = new Date();

        for (const item of snapshots) {
          if (item.product.stock !== null) {
            const updated = await tx.product.updateMany({
              where: { id: item.product.id, stock: { gte: item.quantity }, isAvailable: true },
              data: { stock: { decrement: item.quantity } },
            });
            if (updated.count !== 1) throw new Error(`${item.product.name}库存不足`);
          }
        }
        const split = await reserveGiftCardPayment(tx, { userId, totalAmount, useGiftCard: input.useGiftCard });
        const order = await tx.order.create({
          data: {
            orderNumber: formatOrderNumber(now), checkoutToken: input.token, userId, kind: input.kind,
            totalAmount, pickupName: input.pickupName, pickupPhone: input.pickupPhone,
            pickupAt: new Date(input.pickupAt), note: input.note, paidAt: now,
            items: { create: snapshots.map((item) => ({
              productId: item.product.id, productName: item.product.name, productImage: item.product.imageUrl,
              category: item.product.category, unitPrice: item.unitPrice, quantity: item.quantity,
              options: item.options, subtotal: item.subtotal,
            })) },
            payment: { create: {
              amount: totalAmount, giftCardAmount: split.giftCardAmount, externalAmount: split.externalAmount,
              providerRef: split.externalAmount > 0 ? `SIM-${input.token}` : null, paidAt: now,
            } },
          },
        });
        if (split.giftCardAmount > 0 && split.accountId) {
          await tx.giftCardTransaction.create({ data: {
            accountId: split.accountId, type: "PURCHASE", amount: -split.giftCardAmount,
            reference: `PURCHASE:${input.token}`, orderId: order.id,
          } });
        }
        return { order, split, totalAmount };
      }, { isolationLevel: "Serializable" });
    } catch (transactionError) {
      const winningOrder = await db.order.findUnique({ where: { checkoutToken: input.token }, select: existingOrderSelect });
      if (winningOrder) return unchanged(resultFromExistingOrder(winningOrder, userId));
      throw transactionError;
    }

    return {
      created: true,
      result: {
        ok: true, orderId: transactionResult.order.id, orderNumber: transactionResult.order.orderNumber,
        totalAmount: transactionResult.totalAmount, giftCardAmount: transactionResult.split.giftCardAmount,
        externalAmount: transactionResult.split.externalAmount, demo: false,
      },
    };
  } catch (error) {
    return unchanged({ ok: false, message: sanitizeCheckoutError(error) });
  }
}
