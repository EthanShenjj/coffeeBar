import { giftCardRechargeInputSchema } from "@coffeebar/contracts";
import { executeApi, parseJson, requireBearerUserFromHeaders, routeOptions } from "@/server/api/http";
import { unwrapRechargeResult } from "@/server/api/routes";
import { rechargeGiftCardForUser } from "@/server/services/gift-card-recharge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function POST(request: Request) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const user = await requireBearerUserFromHeaders(request.headers);
    const input = await parseJson(request, giftCardRechargeInputSchema);
    return unwrapRechargeResult(await rechargeGiftCardForUser(user.id, input));
  });
}
