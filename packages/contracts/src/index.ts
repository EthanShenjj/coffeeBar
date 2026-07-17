import { z } from "zod";

const centsSchema = z.number().int();
const nonnegativeCentsSchema = centsSchema.min(0);
const isoDateSchema = z.iso.date();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const optionalUrlSchema = z.string().url().nullable();

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR";

export const apiSuccessSchema = <T extends z.ZodType>(data: T) => z.object({
  ok: z.literal(true),
  data,
});
export type ApiSuccess<T> = { ok: true; data: T };

export const apiFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: apiErrorCodeSchema, message: z.string() }),
});
export type ApiFailure = { ok: false; error: { code: ApiErrorCode; message: string } };

export const cartKindSchema = z.enum(["MENU", "SHOP"]);
export type CartKind = "MENU" | "SHOP";

export const productOptionViewSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  priceDelta: centsSchema,
  isDefault: z.boolean().optional(),
});
export type ProductOptionView = { id: string; name: string; priceDelta: number; isDefault?: boolean };

export const productOptionGroupViewSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  required: z.boolean(),
  maxSelect: z.number().int().min(0),
  options: z.array(productOptionViewSchema),
});
export type ProductOptionGroupView = { id: string; name: string; required: boolean; maxSelect: number; options: ProductOptionView[] };

export const productViewSchema = z.object({
  id: z.string().min(1),
  slug: z.string(),
  name: z.string(),
  subtitle: z.string(),
  description: z.string(),
  channel: cartKindSchema,
  category: z.string(),
  menuCollection: z.enum(["CLASSIC", "SEASONAL"]).optional(),
  menuSection: z.string().optional(),
  price: centsSchema,
  imageUrl: z.string(),
  stock: z.number().int().nullable(),
  isAvailable: z.boolean(),
  optionGroups: z.array(productOptionGroupViewSchema),
});
export type ProductView = {
  id: string; slug: string; name: string; subtitle: string; description: string; channel: CartKind; category: string;
  menuCollection?: "CLASSIC" | "SEASONAL"; menuSection?: string; price: number; imageUrl: string; stock: number | null;
  isAvailable: boolean; optionGroups: ProductOptionGroupView[];
};

export const cartLineSchema = z.object({
  lineId: z.string(),
  product: productViewSchema,
  quantity: z.number().int().min(1),
  optionIds: z.array(z.string()),
});
export type CartLine = { lineId: string; product: ProductView; quantity: number; optionIds: string[] };

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  optionIds: z.array(z.string()).max(8),
});
const checkoutInputSchemaImplementation = z.object({
  token: z.string().uuid(),
  kind: cartKindSchema,
  pickupName: z.string().trim().min(2).max(40),
  pickupPhone: z.string().trim().refine((value) => value === "" || /^1\d{10}$/.test(value), "请输入 11 位手机号"),
  pickupAt: isoDateTimeSchema.refine((value) => {
    const pickupAt = new Date(value).getTime();
    const now = Date.now();
    return Number.isFinite(pickupAt) && pickupAt >= now - 60_000 && pickupAt <= now + 3 * 24 * 60 * 60_000;
  }, "请选择 3 天内的取货时间"),
  note: z.string().trim().max(200).optional(),
  useGiftCard: z.boolean().default(false),
  items: z.array(checkoutItemSchema).min(1).max(30),
});
export type CheckoutInput = {
  token: string; kind: CartKind; pickupName: string; pickupPhone: string; pickupAt: string; note?: string;
  useGiftCard: boolean; items: Array<{ productId: string; quantity: number; optionIds: string[] }>;
};
export const checkoutInputSchema = checkoutInputSchemaImplementation as unknown as z.ZodType<CheckoutInput>;

export const checkoutResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), orderId: z.string(), orderNumber: z.string(), totalAmount: centsSchema, giftCardAmount: centsSchema, externalAmount: centsSchema, demo: z.boolean() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type CheckoutResult =
  | { ok: true; orderId: string; orderNumber: string; totalAmount: number; giftCardAmount: number; externalAmount: number; demo: boolean }
  | { ok: false; message: string };

export const appConfigSchema = z.object({
  supportEmail: z.string().email(),
  termsUrl: z.string().url(),
  privacyUrl: z.string().url(),
  updatedAt: isoDateTimeSchema,
});
export type AppConfig = { supportEmail: string; termsUrl: string; privacyUrl: string; updatedAt: string };

export const announcementSummarySchema = z.object({
  id: z.string(), title: z.string(), summary: z.string(), date: isoDateSchema, read: z.boolean(),
});
export type AnnouncementSummary = { id: string; title: string; summary: string; date: string; read: boolean };
export const announcementDetailSchema = z.object({
  id: z.string(), title: z.string(), summary: z.string(), content: z.string(), coverUrl: optionalUrlSchema,
  publishedAt: isoDateTimeSchema, createdAt: isoDateTimeSchema, read: z.boolean(),
});
export type AnnouncementDetail = { id: string; title: string; summary: string; content: string; coverUrl: string | null; publishedAt: string; createdAt: string; read: boolean };

export const memberLevelSchema = z.object({
  level: z.number().int().min(1),
  currentThreshold: nonnegativeCentsSchema,
  nextThreshold: nonnegativeCentsSchema.nullable(),
  progress: z.number().int().min(0).max(100),
});
export type MemberLevel = { level: number; currentThreshold: number; nextThreshold: number | null; progress: number };

export const profileDashboardSchema = z.object({
  user: z.object({ name: z.string(), email: z.string().email(), role: z.string() }),
  giftCardBalance: centsSchema, totalPaid: centsSchema, monthPaid: centsSchema, orderCount: z.number().int().min(0),
  average: centsSchema, level: memberLevelSchema, months: z.array(z.number().int()), coffeeDays: z.array(isoDateSchema), today: isoDateSchema,
});
export type ProfileDashboard = {
  user: { name: string; email: string; role: string }; giftCardBalance: number; totalPaid: number; monthPaid: number;
  orderCount: number; average: number; level: MemberLevel; months: number[]; coffeeDays: string[]; today: string;
};

export const orderItemSchema = z.object({
  id: z.string(), productId: z.string(), productName: z.string(), productImage: z.string(), category: z.string(),
  unitPrice: centsSchema, quantity: z.number().int().min(1), options: z.array(z.object({ id: z.string(), name: z.string(), priceDelta: centsSchema })), subtotal: centsSchema,
});
export type OrderItem = { id: string; productId: string; productName: string; productImage: string; category: string; unitPrice: number; quantity: number; options: Array<{ id: string; name: string; priceDelta: number }>; subtotal: number };
export const orderSummarySchema = z.object({
  id: z.string(), orderNumber: z.string(), status: z.string(), totalAmount: centsSchema, createdAt: isoDateTimeSchema,
  items: z.array(z.object({ productName: z.string(), quantity: z.number().int().min(1) })),
});
export type OrderSummary = { id: string; orderNumber: string; status: string; totalAmount: number; createdAt: string; items: Array<{ productName: string; quantity: number }> };
export const orderDetailSchema = z.object({
  id: z.string(), orderNumber: z.string(), kind: cartKindSchema, status: z.string(), totalAmount: centsSchema,
  pickupName: z.string(), pickupPhone: z.string(), pickupAt: isoDateTimeSchema, note: z.string().nullable(),
  paidAt: isoDateTimeSchema, createdAt: isoDateTimeSchema, items: z.array(orderItemSchema),
});
export type OrderDetail = { id: string; orderNumber: string; kind: CartKind; status: string; totalAmount: number; pickupName: string; pickupPhone: string; pickupAt: string; note: string | null; paidAt: string; createdAt: string; items: OrderItem[] };

export const giftCardTransactionSchema = z.object({
  id: z.string(), type: z.enum(["RECHARGE", "PURCHASE", "REFUND", "ADJUSTMENT"]), amount: centsSchema,
  reference: z.string(), orderNumber: z.string().nullable(), createdAt: isoDateTimeSchema,
});
export type GiftCardTransaction = { id: string; type: "RECHARGE" | "PURCHASE" | "REFUND" | "ADJUSTMENT"; amount: number; reference: string; orderNumber: string | null; createdAt: string };
export const giftCardSummarySchema = z.object({ balance: centsSchema, transactions: z.array(giftCardTransactionSchema), persistent: z.boolean() });
export type GiftCardSummary = { balance: number; transactions: GiftCardTransaction[]; persistent: boolean };

export const pushTokenRegistrationSchema = z.object({ token: z.string().min(1), platform: z.enum(["IOS", "ANDROID", "WEB"]), deviceId: z.string().min(1).optional() });
export type PushTokenRegistration = { token: string; platform: "IOS" | "ANDROID" | "WEB"; deviceId?: string };
export const pushTokenRegistrationResultSchema = z.object({ registered: z.boolean(), updatedAt: isoDateTimeSchema });
export type PushTokenRegistrationResult = { registered: boolean; updatedAt: string };
