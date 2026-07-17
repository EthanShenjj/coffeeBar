"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PRODUCT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { getDb } from "@/lib/db";
import { notifyOrderStatus } from "@/server/push/order-notifications";

export async function advanceOrder(orderId: string, status: "PREPARING" | "READY" | "COMPLETED") {
  await requireAdmin();
  const order = await getDb().order.update({
    where: { id: orderId },
    data: { status },
    select: { id: true, userId: true, orderNumber: true, status: true },
  });
  try {
    await notifyOrderStatus({
      userId: order.userId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status as typeof status,
    });
  } catch {
    // Order fulfillment must not be rolled back by an optional notification.
  }
  revalidatePath("/admin");
}
export async function toggleProduct(productId: string, isAvailable: boolean) { await requireAdmin(); await getDb().product.update({ where: { id: productId }, data: { isAvailable } }); updateTag(PRODUCT_CATALOG_CACHE_TAG); revalidatePath("/admin"); revalidatePath("/menu"); revalidatePath("/shop"); }

const productSchema = z.object({ id: z.string(), name: z.string().min(2).max(80), description: z.string().min(2).max(500), basePrice: z.number().int().min(100), stock: z.number().int().min(0).nullable(), imageUrl: z.string().url() });
export async function updateProduct(raw: unknown) { await requireAdmin(); const input = productSchema.parse(raw); await getDb().product.update({ where: { id: input.id }, data: { name: input.name, description: input.description, basePrice: input.basePrice, stock: input.stock, imageUrl: input.imageUrl } }); updateTag(PRODUCT_CATALOG_CACHE_TAG); revalidatePath("/admin"); revalidatePath("/menu"); revalidatePath("/shop"); }

const announcementSchema = z.object({ title: z.string().min(2).max(80), summary: z.string().min(2).max(160), content: z.string().min(2).max(5000), publish: z.boolean() });
export async function createAnnouncement(raw: unknown) { await requireAdmin(); const input = announcementSchema.parse(raw); await getDb().announcement.create({ data: { title: input.title, summary: input.summary, content: input.content, status: input.publish ? "PUBLISHED" : "DRAFT", publishedAt: input.publish ? new Date() : null } }); revalidatePath("/admin"); revalidatePath("/messages"); }
