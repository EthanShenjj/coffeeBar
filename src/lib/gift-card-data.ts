import { getSession } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { getGiftCardSummaryForUser } from "@/server/services/gift-cards";

export async function getGiftCardSummary(limit = 20) {
  const session = await getSession();
  if (!session || !hasDatabase()) return { balance: 0, transactions: [], persistent: false };
  const summary = await getGiftCardSummaryForUser(session.user.id, limit);
  return {
    balance: summary.balance,
    persistent: summary.persistent,
    transactions: summary.transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      createdAt: new Date(transaction.createdAt),
      order: transaction.orderNumber ? { orderNumber: transaction.orderNumber } : null,
    })),
  };
}
