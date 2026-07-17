import { requireUserFromHeaders } from "@/lib/auth";
import { executeApi, routeOptions } from "@/server/api/http";
import { requireFound } from "@/server/api/routes";
import { getOrderForUser } from "@/server/services/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const [user, { id }] = await Promise.all([requireUserFromHeaders(request.headers), context.params]);
    return requireFound(await getOrderForUser(user.id, id), "订单不存在");
  });
}
