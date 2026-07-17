import type { OrderDetail, OrderItem, OrderSummary } from "@coffeebar/contracts";
import { getDb } from "@/lib/db";

function orderOptions(value: unknown): OrderItem["options"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const item = option as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.name === "string" && typeof item.priceDelta === "number"
      ? [{ id: item.id, name: item.name, priceDelta: item.priceDelta }]
      : [];
  });
}

export async function getOrdersForUser(userId: string): Promise<OrderSummary[]> {
  const rows = await getDb().order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true,
      items: { select: { productName: true, quantity: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id, orderNumber: row.orderNumber, status: row.status, totalAmount: row.totalAmount,
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((item) => ({ productName: item.productName, quantity: item.quantity })),
  }));
}

export async function getOrderForUser(userId: string, orderId: string): Promise<OrderDetail | null> {
  const row = await getDb().order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true, orderNumber: true, kind: true, status: true, totalAmount: true,
      pickupName: true, pickupPhone: true, pickupAt: true, note: true, paidAt: true, createdAt: true,
      items: { select: {
        id: true, productId: true, productName: true, productImage: true, category: true,
        unitPrice: true, quantity: true, options: true, subtotal: true,
      } },
    },
  });
  if (!row) return null;
  return {
    id: row.id, orderNumber: row.orderNumber, kind: row.kind, status: row.status, totalAmount: row.totalAmount,
    pickupName: row.pickupName, pickupPhone: row.pickupPhone, pickupAt: row.pickupAt.toISOString(), note: row.note,
    paidAt: row.paidAt.toISOString(), createdAt: row.createdAt.toISOString(),
    items: row.items.map((item) => ({ ...item, options: orderOptions(item.options) })),
  };
}
