import { describe, expect, expectTypeOf, it } from "vitest";
import {
  CHECKOUT_MAX_ITEM_LINES,
  CHECKOUT_MAX_OPTION_IDS,
  apiErrorCodeSchema,
  apiFailureSchema,
  apiSuccessSchema,
  announcementDetailSchema,
  announcementSummarySchema,
  appConfigSchema,
  cartLineSchema,
  checkoutInputSchema,
  checkoutResultSchema,
  type CheckoutInput,
  type CheckoutRequestInput,
  giftCardSummarySchema,
  giftCardTransactionSchema,
  orderDetailSchema,
  orderSummarySchema,
  productViewSchema,
  profileDashboardSchema,
  pushTokenRegistrationResultSchema,
  pushTokenRegistrationSchema,
  pushTokenRemovalResultSchema,
  giftCardRechargeInputSchema,
  giftCardRechargeResultSchema,
} from "./index";

const product = { id: "latte", slug: "latte", name: "拿铁", subtitle: "经典", description: "奶咖", channel: "MENU", category: "咖啡", price: 6800, imageUrl: "https://coffeebar.local/latte.png", stock: null, isAvailable: true, optionGroups: [{ id: "milk", name: "奶", required: true, maxSelect: 1, options: [{ id: "oat", name: "燕麦奶", priceDelta: 300, isDefault: false }] }] };
const orderItem = { id: "i1", productId: "latte", productName: "拿铁", productImage: "https://coffeebar.local/latte.png", category: "咖啡", unitPrice: 6800, quantity: 1, options: [], subtotal: 6800 };
const orderSummary = { id: "o1", orderNumber: "CB2607171", status: "PAID", totalAmount: 6800, createdAt: "2026-07-17T09:00:00.000Z", items: [{ productName: "拿铁", quantity: 1 }] };
const orderDetail = { id: "o1", orderNumber: "CB2607171", kind: "MENU", status: "PAID", totalAmount: 6800, pickupName: "林墨", pickupPhone: "13800138000", pickupAt: "2026-07-17T10:00:00.000Z", note: null, paidAt: "2026-07-17T09:00:00.000Z", createdAt: "2026-07-17T09:00:00.000Z", items: [orderItem] };

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
    expectTypeOf<CheckoutInput>().toHaveProperty("useGiftCard").toEqualTypeOf<boolean>();
    expectTypeOf<CheckoutRequestInput>().toMatchTypeOf<{ useGiftCard?: boolean }>();
    expect(checkoutInputSchema.safeParse({ ...valid, pickupAt: "tomorrow" }).success).toBe(false);
    expect(CHECKOUT_MAX_ITEM_LINES).toBe(30);
    expect(CHECKOUT_MAX_OPTION_IDS).toBe(8);
    expect(checkoutInputSchema.safeParse({ ...valid, items: Array.from({ length: 31 }, () => valid.items[0]) }).success).toBe(false);
  });

  it("accepts representative ISO-date wire objects with integer-cent currency", () => {
    expect(appConfigSchema.safeParse({ minimumIosVersion: "1.0.0", maintenance: false, privacyUrl: "https://coffeebar.local/privacy", supportUrl: "https://coffeebar.local/support", apiVersion: "v1" }).success).toBe(true);
    expect(announcementDetailSchema.safeParse({ id: "a1", title: "夏日上新", summary: "冷萃回归", content: "欢迎品尝", coverUrl: null, publishedAt: "2026-07-17T10:00:00.000Z", createdAt: "2026-07-16T10:00:00.000Z", read: false }).success).toBe(true);
    expect(giftCardSummarySchema.safeParse({ balance: 12_800, persistent: true, transactions: [{ id: "t1", type: "RECHARGE", amount: 10_000, reference: "RECHARGE:1", orderNumber: null, createdAt: "2026-07-17T10:00:00.000Z" }] }).success).toBe(true);
    expect(orderDetailSchema.safeParse(orderDetail).success).toBe(true);
    expect(giftCardSummarySchema.safeParse({ balance: 12_800.5, persistent: true, transactions: [] }).success).toBe(false);
  });

  it("validates catalog products and their option groups", () => {
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

  it("validates API success and failure envelopes", () => {
    const successSchema = apiSuccessSchema(productViewSchema);
    expect(successSchema.safeParse({ data: product }).success).toBe(true);
    expect(successSchema.safeParse({ ok: true, data: product }).success).toBe(false);
    expect(apiFailureSchema.safeParse({ error: { code: "NOT_FOUND", message: "商品不存在", fieldErrors: { id: ["不存在"] } } }).success).toBe(true);
    expect(apiFailureSchema.safeParse({ error: { code: "RATE_LIMITED", message: "稍后重试" } }).success).toBe(false);
  });

  it("defines the exact gift-card recharge request and response", () => {
    const input = { token: "00000000-0000-4000-8000-000000000001", amount: 10_000 };
    expect(giftCardRechargeInputSchema.safeParse(input).success).toBe(true);
    expect(giftCardRechargeInputSchema.safeParse({ ...input, amount: 15_000 }).success).toBe(false);
    expect(giftCardRechargeResultSchema.safeParse({ balance: 20_000, idempotent: true }).success).toBe(true);
    expect(giftCardRechargeResultSchema.safeParse({ ok: true, balance: 20_000 }).success).toBe(false);
  });

  it("validates cart lines and checkout results", () => {
    const line = { lineId: "line-1", product, quantity: 2, optionIds: ["oat"] };
    const result = { ok: true, orderId: "o1", orderNumber: "CB2607171", totalAmount: 13_600, giftCardAmount: 3600, externalAmount: 10_000, demo: false };
    expect(cartLineSchema.safeParse(line).success).toBe(true);
    expect(cartLineSchema.safeParse({ ...line, quantity: 0 }).success).toBe(false);
    expect(checkoutResultSchema.safeParse(result).success).toBe(true);
    expect(checkoutResultSchema.safeParse({ ok: false, message: "支付未完成" }).success).toBe(true);
    expect(checkoutResultSchema.safeParse({ ...result, totalAmount: -1 }).success).toBe(false);
    expect(checkoutResultSchema.safeParse({ ...result, giftCardAmount: -1 }).success).toBe(false);
    expect(checkoutResultSchema.safeParse({ ...result, externalAmount: -1 }).success).toBe(false);
  });

  it("validates order summaries and details", () => {
    expect(orderSummarySchema.safeParse(orderSummary).success).toBe(true);
    expect(orderSummarySchema.safeParse({ ...orderSummary, totalAmount: -1 }).success).toBe(false);
    expect(orderDetailSchema.safeParse(orderDetail).success).toBe(true);
    expect(orderDetailSchema.safeParse({ ...orderDetail, totalAmount: -1 }).success).toBe(false);
    expect(orderDetailSchema.safeParse({ ...orderDetail, items: [{ ...orderItem, unitPrice: -1 }] }).success).toBe(false);
    expect(orderDetailSchema.safeParse({ ...orderDetail, items: [{ ...orderItem, subtotal: 10.5 }] }).success).toBe(false);
  });

  it("validates push-token registration payloads and results", () => {
    expect(pushTokenRegistrationSchema.safeParse({ token: "a".repeat(64), deviceId: "iphone-1", environment: "DEVELOPMENT" }).success).toBe(true);
    expect(pushTokenRegistrationSchema.safeParse({ token: "", deviceId: "iphone-1", environment: "DEVELOPMENT" }).success).toBe(false);
    expect(pushTokenRegistrationSchema.safeParse({ token: "not-an-apns-token", deviceId: "iphone-1", environment: "DEVELOPMENT" }).success).toBe(false);
    expect(pushTokenRegistrationSchema.safeParse({ token: "apns-token", deviceId: "", environment: "DEVELOPMENT" }).success).toBe(false);
    expect(pushTokenRegistrationSchema.safeParse({ token: "apns-token", deviceId: "iphone-1", environment: "STAGING" }).success).toBe(false);
    expect(pushTokenRegistrationSchema.safeParse({ token: "apns-token", deviceId: "iphone-1", environment: "DEVELOPMENT", extra: true }).success).toBe(false);
    expect(pushTokenRegistrationResultSchema.safeParse({ registered: true, updatedAt: "2026-07-17T10:00:00.000Z" }).success).toBe(true);
    expect(pushTokenRegistrationResultSchema.safeParse({ registered: true, updatedAt: "today" }).success).toBe(false);
    expect(pushTokenRemovalResultSchema.safeParse({ removed: true }).success).toBe(true);
  });

  it("allows signed deltas but rejects negative balances, prices, stock, and totals", () => {
    expect(productViewSchema.safeParse({ ...product, optionGroups: [{ ...product.optionGroups[0], options: [{ ...product.optionGroups[0].options[0], priceDelta: -300 }] }] }).success).toBe(true);
    expect(productViewSchema.safeParse({ ...product, price: -1 }).success).toBe(false);
    expect(productViewSchema.safeParse({ ...product, stock: -1 }).success).toBe(false);
    expect(giftCardTransactionSchema.safeParse({ id: "t1", type: "PURCHASE", amount: -6800, reference: "PURCHASE:o1", orderNumber: "CB2607171", createdAt: "2026-07-17T10:00:00.000Z" }).success).toBe(true);
    expect(giftCardSummarySchema.safeParse({ balance: -1, persistent: true, transactions: [] }).success).toBe(false);
    const dashboard = { user: { name: "Coffee Lover", email: "demo@coffeebar.local", role: "CUSTOMER" }, giftCardBalance: 0, totalPaid: 68_600, monthPaid: 12_800, orderCount: 18, average: 3811, level: { level: 3, currentThreshold: 30_000, nextThreshold: 60_000, progress: 64 }, months: [38, 62, 45, 79, 54, 88], coffeeDays: [], today: "2026-07-17" };
    expect(profileDashboardSchema.safeParse({ ...dashboard, giftCardBalance: -1 }).success).toBe(false);
    expect(profileDashboardSchema.safeParse({ ...dashboard, totalPaid: -1 }).success).toBe(false);
    expect(profileDashboardSchema.safeParse({ ...dashboard, monthPaid: -1 }).success).toBe(false);
    expect(profileDashboardSchema.safeParse({ ...dashboard, average: -1 }).success).toBe(false);
  });
});
