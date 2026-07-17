import { getDb } from "@/lib/db";
import { getMemberLevel } from "@/lib/levels";

const shanghaiDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
});
const nonDrinkMenuCategories = new Set(["甜品", "咖啡豆"]);

function toShanghaiDateKey(date: Date) {
  const parts = Object.fromEntries(shanghaiDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

type DashboardUser = { name: string; email: string; role?: string };

export async function getProfileDashboardForUser(userId: string, user: DashboardUser) {
  const [orders, account] = await Promise.all([
    getDb().order.findMany({
      where: { userId }, orderBy: { createdAt: "desc" },
      select: { totalAmount: true, paidAt: true, kind: true, items: { select: { category: true } } },
    }),
    getDb().giftCardAccount.findUnique({ where: { userId }, select: { balance: true } }),
  ]);
  const now = new Date();
  const totalPaid = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const monthPaid = orders.filter((order) => order.paidAt.getFullYear() === now.getFullYear() && order.paidAt.getMonth() === now.getMonth()).reduce((sum, order) => sum + order.totalAmount, 0);
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return orders.filter((order) => order.paidAt.getFullYear() === date.getFullYear() && order.paidAt.getMonth() === date.getMonth()).reduce((sum, order) => sum + order.totalAmount, 0);
  });
  const peak = Math.max(...buckets, 1);
  const coffeeDays = [...new Set(orders
    .filter((order) => order.kind === "MENU" && order.items.some((item) => !nonDrinkMenuCategories.has(item.category)))
    .map((order) => toShanghaiDateKey(order.paidAt)))].sort();
  return {
    user: { name: user.name, email: user.email, role: user.role ?? "CUSTOMER" },
    giftCardBalance: account?.balance ?? 0, totalPaid, monthPaid, orderCount: orders.length,
    average: orders.length ? Math.round(totalPaid / orders.length) : 0,
    level: getMemberLevel(totalPaid), months: buckets.map((value) => Math.round((value / peak) * 100)),
    coffeeDays, today: toShanghaiDateKey(now),
  };
}

export async function getAccountProfileForUser(userId: string) {
  const row = await getDb().user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, image: true, profile: { select: { phone: true, birthday: true } } },
  });
  if (!row) return null;
  return {
    name: row.name, email: row.email, image: row.image ?? "", phone: row.profile?.phone ?? "",
    birthday: row.profile?.birthday?.toISOString().slice(0, 10) ?? "",
  };
}

export function updateProfileForUser(userId: string, input: { name: string; phone: string; birthday?: string }) {
  return getDb().user.update({
    where: { id: userId },
    data: { name: input.name, profile: { upsert: {
      create: { phone: input.phone || null, birthday: input.birthday ? new Date(input.birthday) : null },
      update: { phone: input.phone || null, birthday: input.birthday ? new Date(input.birthday) : null },
    } } },
  }).then(() => undefined);
}
