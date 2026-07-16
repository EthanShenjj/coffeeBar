import type { Prisma } from "@/generated/prisma/client";
import {
  calculatePaymentSplit,
  type PaymentSplit,
} from "@/lib/gift-card";

type CreditGiftCardInput = {
  userId: string;
  amount: number;
  reference: string;
};

type ReserveGiftCardPaymentInput = {
  userId: string;
  totalAmount: number;
  useGiftCard: boolean;
};

export type ReservedGiftCardPayment = PaymentSplit & {
  accountId: string | null;
};

type RechargeTransaction = {
  type: string;
  account: {
    userId: string;
    balance: number;
  };
};

function duplicateResult(
  transaction: RechargeTransaction | null,
  userId: string,
) {
  if (!transaction
    || transaction.type !== "RECHARGE"
    || transaction.account.userId !== userId) {
    throw new Error("充值令牌不可用");
  }

  return { balance: transaction.account.balance, duplicate: true } as const;
}

const duplicateInclude = {
  account: { select: { userId: true, balance: true } },
} as const;

export async function creditGiftCard(
  tx: Prisma.TransactionClient,
  input: CreditGiftCardInput,
) {
  const existing = await tx.giftCardTransaction.findUnique({
    where: { reference: input.reference },
    include: duplicateInclude,
  });
  if (existing) return duplicateResult(existing, input.userId);

  const account = await tx.giftCardAccount.upsert({
    where: { userId: input.userId },
    update: {},
    create: { userId: input.userId },
  });
  const inserted = await tx.giftCardTransaction.createMany({
    data: [{
      accountId: account.id,
      type: "RECHARGE",
      amount: input.amount,
      reference: input.reference,
    }],
    skipDuplicates: true,
  });

  if (inserted.count === 0) {
    const duplicate = await tx.giftCardTransaction.findUnique({
      where: { reference: input.reference },
      include: duplicateInclude,
    });
    return duplicateResult(duplicate, input.userId);
  }

  const updated = await tx.giftCardAccount.update({
    where: { id: account.id },
    data: { balance: { increment: input.amount } },
  });
  return { balance: updated.balance, duplicate: false } as const;
}

export async function reserveGiftCardPayment(
  tx: Prisma.TransactionClient,
  input: ReserveGiftCardPaymentInput,
): Promise<ReservedGiftCardPayment> {
  if (!input.useGiftCard) {
    return {
      ...calculatePaymentSplit(input.totalAmount, 0, false),
      accountId: null,
    };
  }

  const account = await tx.giftCardAccount.upsert({
    where: { userId: input.userId },
    update: {},
    create: { userId: input.userId },
  });
  const split = calculatePaymentSplit(
    input.totalAmount,
    account.balance,
    true,
  );

  if (split.giftCardAmount === 0) {
    return { ...split, accountId: account.id };
  }

  const updated = await tx.giftCardAccount.updateMany({
    where: {
      id: account.id,
      balance: { gte: split.giftCardAmount },
    },
    data: { balance: { decrement: split.giftCardAmount } },
  });
  if (updated.count !== 1) {
    throw new Error("购物卡余额已变化，请重试支付");
  }

  return { ...split, accountId: account.id };
}
