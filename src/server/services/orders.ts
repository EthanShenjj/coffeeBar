import { getDb } from "@/lib/db";

export function getOrdersForUser(userId: string) {
  return getDb().order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}

export function getOrderForUser(userId: string, orderId: string) {
  return getDb().order.findFirst({
    where: { id: orderId, userId },
    include: { items: true, payment: true },
  });
}
