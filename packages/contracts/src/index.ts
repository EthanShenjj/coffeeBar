import { z } from "zod";

const signedCentsSchema = z.number().int();
const nonnegativeCentsSchema = z.number().int().min(0);
const nonnegativeIntegerSchema = z.number().int().min(0);
const percentageSchema = z.number().int().min(0).max(100);
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
export type ApiErrorCode = z.output<typeof apiErrorCodeSchema>;

export const apiSuccessSchema = <T extends z.ZodType>(data: T) => z.object({ data }).strict();
export type ApiSuccess<T> = z.output<ReturnType<typeof apiSuccessSchema<z.ZodType<T>>>>;

export const apiFailureSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }).strict(),
}).strict();
export type ApiFailure = z.output<typeof apiFailureSchema>;

export const cartKindSchema = z.enum(["MENU", "SHOP"]);
export type CartKind = z.output<typeof cartKindSchema>;

export const productOptionViewSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  priceDelta: signedCentsSchema,
  isDefault: z.boolean().optional(),
});
export type ProductOptionView = z.output<typeof productOptionViewSchema>;

export const productOptionGroupViewSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  required: z.boolean(),
  maxSelect: nonnegativeIntegerSchema,
  options: z.array(productOptionViewSchema),
});
export type ProductOptionGroupView = z.output<typeof productOptionGroupViewSchema>;

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
  price: nonnegativeCentsSchema,
  imageUrl: z.string(),
  stock: nonnegativeIntegerSchema.nullable(),
  isAvailable: z.boolean(),
  optionGroups: z.array(productOptionGroupViewSchema),
});
export type ProductView = z.output<typeof productViewSchema>;

export const cartLineSchema = z.object({
  lineId: z.string(),
  product: productViewSchema,
  quantity: z.number().int().min(1),
  optionIds: z.array(z.string()),
});
export type CartLine = z.output<typeof cartLineSchema>;

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  optionIds: z.array(z.string()).max(8),
});
export const checkoutInputSchema = z.object({
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
export type CheckoutInput = z.output<typeof checkoutInputSchema>;
export type CheckoutRequestInput = z.input<typeof checkoutInputSchema>;

export const checkoutResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), orderId: z.string(), orderNumber: z.string(), totalAmount: nonnegativeCentsSchema, giftCardAmount: nonnegativeCentsSchema, externalAmount: nonnegativeCentsSchema, demo: z.boolean() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type CheckoutResult = z.output<typeof checkoutResultSchema>;

export const appConfigSchema = z.object({
  minimumIosVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  maintenance: z.boolean(),
  privacyUrl: z.string().url(),
  supportUrl: z.string().url(),
  apiVersion: z.literal("v1"),
}).strict();
export type AppConfig = z.output<typeof appConfigSchema>;

export const giftCardRechargeInputSchema = z.object({
  token: z.string().uuid(),
  amount: z.union(
    [z.literal(10_000), z.literal(20_000), z.literal(30_000), z.literal(50_000)],
    { error: "请选择有效的充值金额" },
  ),
}).strict();
export type GiftCardRechargeInput = z.output<typeof giftCardRechargeInputSchema>;
export const giftCardRechargeResultSchema = z.object({
  balance: nonnegativeCentsSchema,
  idempotent: z.boolean(),
}).strict();
export type GiftCardRechargeResult = z.output<typeof giftCardRechargeResultSchema>;

export const announcementSummarySchema = z.object({
  id: z.string(), title: z.string(), summary: z.string(), date: isoDateSchema, read: z.boolean(),
});
export type AnnouncementSummary = z.output<typeof announcementSummarySchema>;
export const announcementDetailSchema = z.object({
  id: z.string(), title: z.string(), summary: z.string(), content: z.string(), coverUrl: optionalUrlSchema,
  publishedAt: isoDateTimeSchema, createdAt: isoDateTimeSchema, read: z.boolean(),
});
export type AnnouncementDetail = z.output<typeof announcementDetailSchema>;

export const memberLevelSchema = z.object({
  level: z.number().int().min(1),
  currentThreshold: nonnegativeCentsSchema,
  nextThreshold: nonnegativeCentsSchema.nullable(),
  progress: percentageSchema,
});
export type MemberLevel = z.output<typeof memberLevelSchema>;

export const profileDashboardSchema = z.object({
  user: z.object({ name: z.string(), email: z.string().email(), role: z.string() }),
  giftCardBalance: nonnegativeCentsSchema, totalPaid: nonnegativeCentsSchema, monthPaid: nonnegativeCentsSchema, orderCount: nonnegativeIntegerSchema,
  average: nonnegativeCentsSchema, level: memberLevelSchema, months: z.array(percentageSchema), coffeeDays: z.array(isoDateSchema), today: isoDateSchema,
});
export type ProfileDashboard = z.output<typeof profileDashboardSchema>;

export const orderItemSchema = z.object({
  id: z.string(), productId: z.string(), productName: z.string(), productImage: z.string(), category: z.string(),
  unitPrice: nonnegativeCentsSchema, quantity: z.number().int().min(1), options: z.array(z.object({ id: z.string(), name: z.string(), priceDelta: signedCentsSchema })), subtotal: nonnegativeCentsSchema,
});
export type OrderItem = z.output<typeof orderItemSchema>;
export const orderSummarySchema = z.object({
  id: z.string(), orderNumber: z.string(), status: z.string(), totalAmount: nonnegativeCentsSchema, createdAt: isoDateTimeSchema,
  items: z.array(z.object({ productName: z.string(), quantity: z.number().int().min(1) })),
});
export type OrderSummary = z.output<typeof orderSummarySchema>;
export const orderDetailSchema = z.object({
  id: z.string(), orderNumber: z.string(), kind: cartKindSchema, status: z.string(), totalAmount: nonnegativeCentsSchema,
  pickupName: z.string(), pickupPhone: z.string(), pickupAt: isoDateTimeSchema, note: z.string().nullable(),
  paidAt: isoDateTimeSchema, createdAt: isoDateTimeSchema, items: z.array(orderItemSchema),
});
export type OrderDetail = z.output<typeof orderDetailSchema>;

export const giftCardTransactionSchema = z.object({
  id: z.string(), type: z.enum(["RECHARGE", "PURCHASE", "REFUND", "ADJUSTMENT"]), amount: signedCentsSchema,
  reference: z.string(), orderNumber: z.string().nullable(), createdAt: isoDateTimeSchema,
});
export type GiftCardTransaction = z.output<typeof giftCardTransactionSchema>;
export const giftCardSummarySchema = z.object({ balance: nonnegativeCentsSchema, transactions: z.array(giftCardTransactionSchema), persistent: z.boolean() });
export type GiftCardSummary = z.output<typeof giftCardSummarySchema>;

export const pushEnvironmentSchema = z.enum(["DEVELOPMENT", "PRODUCTION"]);
export type PushEnvironment = z.output<typeof pushEnvironmentSchema>;
export const pushDeviceIdSchema = z.string().trim().min(1).max(200);
export const pushTokenRegistrationSchema = z.object({
  token: z.string().trim().regex(/^[A-Fa-f0-9]{64,200}$/),
  deviceId: pushDeviceIdSchema,
  environment: pushEnvironmentSchema,
}).strict();
export type PushTokenRegistration = z.output<typeof pushTokenRegistrationSchema>;
export const pushTokenRegistrationResultSchema = z.object({ registered: z.boolean(), updatedAt: isoDateTimeSchema }).strict();
export type PushTokenRegistrationResult = z.output<typeof pushTokenRegistrationResultSchema>;
export const pushTokenRemovalResultSchema = z.object({ removed: z.boolean() }).strict();
export type PushTokenRemovalResult = z.output<typeof pushTokenRemovalResultSchema>;
