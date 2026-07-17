import { executeApi, requireBearerUserFromHeaders, routeOptions } from "@/server/api/http";
import { getProfileDashboardForUser } from "@/server/services/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function GET(request: Request) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const user = await requireBearerUserFromHeaders(request.headers);
    return getProfileDashboardForUser(user.id, { name: user.name, email: user.email, role: user.role });
  });
}
