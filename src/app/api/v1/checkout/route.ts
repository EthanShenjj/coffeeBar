import { checkoutInputSchema } from "@coffeebar/contracts";
import { executeApi, parseJson, requireBearerUserFromHeaders, routeOptions } from "@/server/api/http";
import { unwrapCheckoutResult } from "@/server/api/routes";
import { checkoutForUser } from "@/server/services/checkout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function POST(request: Request) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const user = await requireBearerUserFromHeaders(request.headers);
    const input = await parseJson(request, checkoutInputSchema);
    const service = await checkoutForUser(user.id, input);
    return unwrapCheckoutResult(service.result);
  });
}
