import { giftCardRechargeInputSchema } from "@coffeebar/contracts";
import { requireUserFromHeaders } from "@/lib/auth";
import { executeApi, parseJson, routeOptions } from "@/server/api/http";
import { unwrapRechargeResult } from "@/server/api/routes";
import { rechargeGiftCardForUser } from "@/server/services/gift-card-recharge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function POST(request: Request) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const user = await requireUserFromHeaders(request.headers);
    const input = await parseJson(request, giftCardRechargeInputSchema);
    return unwrapRechargeResult(await rechargeGiftCardForUser(user.id, input));
  });
}
