import { pushTokenRegistrationSchema, pushTokenRegistrationResultSchema } from "@coffeebar/contracts";
import {
  executeApi,
  parseJson,
  requireBearerUserFromHeaders,
  routeOptions,
  validateApiOutput,
} from "@/server/api/http";
import { registerPushTokenForUser } from "@/server/services/push-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function PUT(request: Request) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const user = await requireBearerUserFromHeaders(request.headers);
    const input = await parseJson(request, pushTokenRegistrationSchema);
    return validateApiOutput(pushTokenRegistrationResultSchema, await registerPushTokenForUser(user.id, input));
  });
}
