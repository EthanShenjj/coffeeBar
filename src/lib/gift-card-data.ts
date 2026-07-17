import { getSession } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { getGiftCardSummaryForUser } from "@/server/services/gift-cards";

export async function getGiftCardSummary(limit = 20) {
  const session = await getSession();
  if (!session || !hasDatabase()) return { balance: 0, transactions: [], persistent: false };
  return getGiftCardSummaryForUser(session.user.id, limit);
}
