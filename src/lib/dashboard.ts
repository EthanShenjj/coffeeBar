import { DEMO_ANNOUNCEMENTS } from "@/lib/demo-data";
import { getSession } from "@/lib/auth";
import { getDb, hasDatabase } from "@/lib/db";
import { getMemberLevel } from "@/lib/levels";

const shanghaiDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const nonDrinkMenuCategories = new Set(["甜品", "咖啡豆"]);

function toShanghaiDateKey(date: Date) {
  const parts = Object.fromEntries(shanghaiDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function getProfileDashboard() {
  const session = await getSession();
  if (!session || !hasDatabase()) {
    const totalPaid = 68_600;
    const today = toShanghaiDateKey(new Date());
    return { user: { name: session?.user.name ?? "Coffee Lover", email: session?.user.email ?? "demo@coffeebar.local", role: "CUSTOMER" }, totalPaid, monthPaid: 12_800, orderCount: 18, average: 3811, level: getMemberLevel(totalPaid), months: [38, 62, 45, 79, 54, 88], coffeeDays: [], today };
  }
  const db = getDb();
  const orders = await db.order.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, select: { totalAmount: true, paidAt: true, kind: true, items: { select: { category: true } } } });
  const now = new Date();
  const totalPaid = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const monthPaid = orders.filter((order) => order.paidAt.getFullYear() === now.getFullYear() && order.paidAt.getMonth() === now.getMonth()).reduce((sum, order) => sum + order.totalAmount, 0);
  const buckets = Array.from({ length: 6 }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1); return orders.filter((order) => order.paidAt.getFullYear() === date.getFullYear() && order.paidAt.getMonth() === date.getMonth()).reduce((sum, order) => sum + order.totalAmount, 0); });
  const peak = Math.max(...buckets, 1);
  const coffeeDays = [...new Set(orders
    .filter((order) => order.kind === "MENU" && order.items.some((item) => !nonDrinkMenuCategories.has(item.category)))
    .map((order) => toShanghaiDateKey(order.paidAt)))].sort();
  return { user: { name: session.user.name, email: session.user.email, role: (session.user as typeof session.user & { role?: string }).role ?? "CUSTOMER" }, totalPaid, monthPaid, orderCount: orders.length, average: orders.length ? Math.round(totalPaid / orders.length) : 0, level: getMemberLevel(totalPaid), months: buckets.map((value) => Math.round((value / peak) * 100)), coffeeDays, today: toShanghaiDateKey(now) };
}

export async function getAccountProfile() {
  const session = await getSession();
  if (!session || !hasDatabase()) return null;
  const row = await getDb().user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, profile: { select: { phone: true, birthday: true } } },
  });
  if (!row) return null;
  return {
    name: row.name,
    email: row.email,
    image: row.image ?? "",
    phone: row.profile?.phone ?? "",
    birthday: row.profile?.birthday?.toISOString().slice(0, 10) ?? "",
  };
}

export async function getOrders() {
  const session = await getSession();
  if (!session || !hasDatabase()) return [
    { id: "demo-1", orderNumber: "CB2607121842A9F1", status: "COMPLETED", totalAmount: 6800, createdAt: new Date("2026-07-12T10:42:00"), items: [{ productName: "黑白拿铁", quantity: 1 }, { productName: "原味巴斯克", quantity: 1 }] },
    { id: "demo-2", orderNumber: "CB2607061021C3D8", status: "READY", totalAmount: 3600, createdAt: new Date("2026-07-06T02:21:00"), items: [{ productName: "青提冷萃", quantity: 1 }] },
  ];
  return getDb().order.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, include: { items: true } });
}

export async function getAnnouncements() {
  const session = await getSession();
  if (!hasDatabase()) return DEMO_ANNOUNCEMENTS;
  const rows = await getDb().announcement.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, include: { receipts: session ? { where: { userId: session.user.id }, select: { id: true } } : false } });
  return rows.map((item) => ({ id: item.id, title: item.title, summary: item.summary, date: (item.publishedAt ?? item.createdAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }), read: "receipts" in item && Array.isArray(item.receipts) && item.receipts.length > 0 }));
}

export async function getAdminData() {
  if (!hasDatabase()) return null;
  const db = getDb();
  const [products, orders, announcements, revenue] = await Promise.all([
    db.product.findMany({ orderBy: [{ channel: "asc" }, { sortOrder: "asc" }], take: 50 }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { items: { select: { productName: true, quantity: true } } } }),
    db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.payment.aggregate({ _sum: { amount: true }, _count: true }),
  ]);
  return { products, orders, announcements, revenue: revenue._sum.amount ?? 0, paymentCount: revenue._count };
}
