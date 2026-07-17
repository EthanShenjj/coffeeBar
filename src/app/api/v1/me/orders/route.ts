import { executeApi, requireBearerUserFromHeaders, routeOptions } from "@/server/api/http";
import { getOrdersForUser } from "@/server/services/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function GET(request: Request) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const user = await requireBearerUserFromHeaders(request.headers);
    return getOrdersForUser(user.id);
  });
}
