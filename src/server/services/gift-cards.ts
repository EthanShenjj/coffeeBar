import type { GiftCardSummary } from "@coffeebar/contracts";
import { getDb } from "@/lib/db";

export async function getGiftCardSummaryForUser(userId: string, limit = 20): Promise<GiftCardSummary> {
  const account = await getDb().giftCardAccount.findUnique({
    where: { userId },
    select: {
      balance: true,
      transactions: {
        orderBy: { createdAt: "desc" }, take: limit,
        select: {
          id: true, type: true, amount: true, reference: true, createdAt: true,
          order: { select: { orderNumber: true } },
        },
      },
    },
  });
  return {
    balance: account?.balance ?? 0,
    persistent: true,
    transactions: (account?.transactions ?? []).map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      reference: transaction.reference,
      orderNumber: transaction.order?.orderNumber ?? null,
      createdAt: transaction.createdAt.toISOString(),
    })),
  };
}
