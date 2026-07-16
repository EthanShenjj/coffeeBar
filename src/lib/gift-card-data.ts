import { getSession } from "@/lib/auth";
import { getDb, hasDatabase } from "@/lib/db";

export async function getGiftCardSummary(limit = 20) {
  const session = await getSession();
  if (!session || !hasDatabase()) {
    return { balance: 0, transactions: [], persistent: false };
  }

  const account = await getDb().giftCardAccount.findUnique({
    where: { userId: session.user.id },
    select: {
      balance: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
        },
      },
    },
  });

  return {
    balance: account?.balance ?? 0,
    transactions: account?.transactions ?? [],
    persistent: true,
  };
}
