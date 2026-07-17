import { checkoutInputSchema } from "@coffeebar/contracts";
import { requireUserFromHeaders } from "@/lib/auth";
import { executeApi, parseJson, routeOptions } from "@/server/api/http";
import { unwrapCheckoutResult } from "@/server/api/routes";
import { checkoutForUser } from "@/server/services/checkout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function POST(request: Request) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const user = await requireUserFromHeaders(request.headers);
    const input = await parseJson(request, checkoutInputSchema);
    const service = await checkoutForUser(user.id, input);
    return unwrapCheckoutResult(service.result);
  });
}
