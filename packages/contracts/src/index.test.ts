import { describe, expect, it } from "vitest";
import {
  apiErrorCodeSchema,
  announcementDetailSchema,
  announcementSummarySchema,
  appConfigSchema,
  checkoutInputSchema,
  giftCardSummarySchema,
  orderDetailSchema,
  productViewSchema,
  profileDashboardSchema,
} from "./index";

describe("shared API contracts", () => {
  it("accepts only the documented API error codes", () => {
    expect(apiErrorCodeSchema.options).toEqual([
      "VALIDATION_ERROR", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND",
      "CONFLICT", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR",
    ]);
    expect(apiErrorCodeSchema.safeParse("RATE_LIMITED").success).toBe(false);
  });

  it("validates checkout payloads and rejects invalid pickup dates", () => {
    const valid = {
      token: "a6236aeb-4e08-44f4-b9d4-c927219563af", kind: "MENU", pickupName: "林墨",
      pickupPhone: "13800138000", pickupAt: new Date(Date.now() + 3_600_000).toISOString(),
      items: [{ productId: "latte", quantity: 1, optionIds: ["oat"] }],
    };
    expect(checkoutInputSchema.safeParse(valid).success).toBe(true);
    expect(checkoutInputSchema.safeParse({ ...valid, pickupAt: "tomorrow" }).success).toBe(false);
  });

  it("accepts representative ISO-date wire objects with integer-cent currency", () => {
    expect(appConfigSchema.safeParse({ supportEmail: "hello@coffeebar.local", termsUrl: "https://coffeebar.local/terms", privacyUrl: "https://coffeebar.local/privacy", updatedAt: "2026-07-17T10:00:00.000Z" }).success).toBe(true);
    expect(announcementDetailSchema.safeParse({ id: "a1", title: "夏日上新", summary: "冷萃回归", content: "欢迎品尝", coverUrl: null, publishedAt: "2026-07-17T10:00:00.000Z", createdAt: "2026-07-16T10:00:00.000Z", read: false }).success).toBe(true);
    expect(giftCardSummarySchema.safeParse({ balance: 12_800, persistent: true, transactions: [{ id: "t1", type: "RECHARGE", amount: 10_000, reference: "RECHARGE:1", orderNumber: null, createdAt: "2026-07-17T10:00:00.000Z" }] }).success).toBe(true);
    expect(orderDetailSchema.safeParse({ id: "o1", orderNumber: "CB2607171", kind: "MENU", status: "PAID", totalAmount: 6800, pickupName: "林墨", pickupPhone: "13800138000", pickupAt: "2026-07-17T10:00:00.000Z", note: null, paidAt: "2026-07-17T09:00:00.000Z", createdAt: "2026-07-17T09:00:00.000Z", items: [{ id: "i1", productId: "latte", productName: "拿铁", productImage: "https://coffeebar.local/latte.png", category: "咖啡", unitPrice: 6800, quantity: 1, options: [], subtotal: 6800 }] }).success).toBe(true);
    expect(giftCardSummarySchema.safeParse({ balance: 12_800.5, persistent: true, transactions: [] }).success).toBe(false);
  });

  it("validates catalog products and their option groups", () => {
    const product = { id: "latte", slug: "latte", name: "拿铁", subtitle: "经典", description: "奶咖", channel: "MENU", category: "咖啡", price: 6800, imageUrl: "https://coffeebar.local/latte.png", stock: null, isAvailable: true, optionGroups: [{ id: "milk", name: "奶", required: true, maxSelect: 1, options: [{ id: "oat", name: "燕麦奶", priceDelta: 300, isDefault: false }] }] };
    expect(productViewSchema.safeParse(product).success).toBe(true);
    expect(productViewSchema.safeParse({ ...product, price: 68.5 }).success).toBe(false);
  });

  it("rejects malformed announcement and dashboard ISO dates", () => {
    const announcement = { id: "a1", title: "夏日上新", summary: "冷萃回归", date: "2026-07-17", read: false };
    const dashboard = {
      user: { name: "Coffee Lover", email: "demo@coffeebar.local", role: "CUSTOMER" },
      giftCardBalance: 0, totalPaid: 68_600, monthPaid: 12_800, orderCount: 18, average: 3811,
      level: { level: 3, currentThreshold: 30_000, nextThreshold: 60_000, progress: 64 },
      months: [38, 62, 45, 79, 54, 88], coffeeDays: ["2026-07-16"], today: "2026-07-17",
    };
    expect(announcementSummarySchema.safeParse(announcement).success).toBe(true);
    expect(announcementSummarySchema.safeParse({ ...announcement, date: "07.17" }).success).toBe(false);
    expect(profileDashboardSchema.safeParse(dashboard).success).toBe(true);
    expect(profileDashboardSchema.safeParse({ ...dashboard, coffeeDays: ["July 16"] }).success).toBe(false);
    expect(profileDashboardSchema.safeParse({ ...dashboard, today: "2026/07/17" }).success).toBe(false);
  });

  it("requires a valid member level with nonnegative integer-cent thresholds", () => {
    const dashboard = {
      user: { name: "Coffee Lover", email: "demo@coffeebar.local", role: "CUSTOMER" },
      giftCardBalance: 0, totalPaid: 68_600, monthPaid: 12_800, orderCount: 18, average: 3811,
      level: { level: 3, currentThreshold: 30_000, nextThreshold: 60_000, progress: 64 },
      months: [38, 62, 45, 79, 54, 88], coffeeDays: [], today: "2026-07-17",
    };
    expect(profileDashboardSchema.safeParse(dashboard).success).toBe(true);
    expect(profileDashboardSchema.safeParse({ ...dashboard, level: { ...dashboard.level, currentThreshold: -1 } }).success).toBe(false);
    expect(profileDashboardSchema.safeParse({ ...dashboard, level: { ...dashboard.level, nextThreshold: 60_000.5 } }).success).toBe(false);
    expect(profileDashboardSchema.safeParse({ ...dashboard, level: { level: "three" } }).success).toBe(false);
    expect(profileDashboardSchema.safeParse({ ...dashboard, level: { ...dashboard.level, nextThreshold: null } }).success).toBe(true);
  });
});
