import { AdminConsole } from "@/components/admin-console";
import { requireAdmin } from "@/lib/auth";
import { getAdminData } from "@/lib/dashboard";
import { hasDatabase } from "@/lib/db";
import { getDemoAdminData } from "@/lib/admin-demo";

export default async function AdminPage() {
  const demo = !hasDatabase();
  if (!demo) await requireAdmin();
  const data = await getAdminData();
  const normalized = data ? { ...data, orders: data.orders.map((order) => ({ ...order, pickupAt: order.pickupAt.toISOString() })) } : getDemoAdminData();
  return <AdminConsole data={normalized} demo={demo} />;
}
