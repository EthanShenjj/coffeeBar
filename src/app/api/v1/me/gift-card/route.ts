import { executeApi, requireBearerUserFromHeaders, routeOptions } from "@/server/api/http";
import { getGiftCardSummaryForUser } from "@/server/services/gift-cards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function GET(request: Request) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const user = await requireBearerUserFromHeaders(request.headers);
    return getGiftCardSummaryForUser(user.id);
  });
}
