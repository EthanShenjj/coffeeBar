import { getDb } from "@/lib/db";

export async function getGiftCardSummaryForUser(userId: string, limit = 20) {
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
  return { balance: account?.balance ?? 0, transactions: account?.transactions ?? [], persistent: true };
}
