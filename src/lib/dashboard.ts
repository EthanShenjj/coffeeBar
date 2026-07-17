import { getSession } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { DEMO_ANNOUNCEMENTS } from "@/lib/demo-data";
import { getMemberLevel } from "@/lib/levels";
import { getAnnouncementsForUser } from "@/server/services/announcements";
import { getOrdersForUser } from "@/server/services/orders";
import { getAccountProfileForUser, getProfileDashboardForUser } from "@/server/services/profiles";
import { getDb } from "@/lib/db";

const shanghaiDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
});
function toShanghaiDateKey(date: Date) {
  const parts = Object.fromEntries(shanghaiDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function getProfileDashboard() {
  const session = await getSession();
  if (!session || !hasDatabase()) {
    const totalPaid = 68600;
    return {
      user: { name: session?.user.name ?? "Coffee Lover", email: session?.user.email ?? "demo@coffeebar.local", role: "CUSTOMER" },
      giftCardBalance: 0, totalPaid, monthPaid: 12800, orderCount: 18, average: 3811,
      level: getMemberLevel(totalPaid), months: [38, 62, 45, 79, 54, 88], coffeeDays: [], today: toShanghaiDateKey(new Date()),
    };
  }
  return getProfileDashboardForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
    role: (session.user as typeof session.user & { role?: string }).role,
  });
}

export async function getAccountProfile() {
  const session = await getSession();
  if (!session || !hasDatabase()) return null;
  return getAccountProfileForUser(session.user.id);
}

export async function getOrders() {
  const session = await getSession();
  if (!session || !hasDatabase()) return [
    { id: "demo-1", orderNumber: "CB2607121842A9F1", status: "COMPLETED", totalAmount: 6800, createdAt: new Date("2026-07-12T10:42:00"), items: [{ productName: "黑白拿铁", quantity: 1 }, { productName: "原味巴斯克", quantity: 1 }] },
    { id: "demo-2", orderNumber: "CB2607061021C3D8", status: "READY", totalAmount: 3600, createdAt: new Date("2026-07-06T02:21:00"), items: [{ productName: "青提冷萃", quantity: 1 }] },
  ];
  const orders = await getOrdersForUser(session.user.id);
  return orders.map((order) => ({ ...order, createdAt: new Date(order.createdAt) }));
}

export async function getAnnouncements() {
  const session = await getSession();
  if (!hasDatabase()) return DEMO_ANNOUNCEMENTS;
  const rows = await getAnnouncementsForUser(session?.user.id ?? null);
  return rows.map((item) => ({
    id: item.id, title: item.title, summary: item.summary,
    date: item.date.slice(5).replace("-", "."), read: item.read,
  }));
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
