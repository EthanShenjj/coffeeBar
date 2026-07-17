import { cartKindSchema } from "@coffeebar/contracts";
import { getProducts } from "@/lib/catalog";
import { executeApi, routeOptions } from "@/server/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function GET(request: Request) {
  return executeApi(request, { access: "public" }, async () => {
    const channel = cartKindSchema.parse(new URL(request.url).searchParams.get("channel"));
    return getProducts(channel);
  });
}
