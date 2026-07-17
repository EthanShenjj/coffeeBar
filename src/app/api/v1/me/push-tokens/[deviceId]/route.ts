import { pushDeviceIdSchema, pushTokenRemovalResultSchema } from "@coffeebar/contracts";
import {
  executeApi,
  requireBearerUserFromHeaders,
  routeOptions,
  validateApiOutput,
} from "@/server/api/http";
import { removePushTokenForUser } from "@/server/services/push-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function DELETE(request: Request, context: { params: Promise<{ deviceId: string }> }) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const [user, params] = await Promise.all([
      requireBearerUserFromHeaders(request.headers),
      context.params,
    ]);
    const deviceId = pushDeviceIdSchema.parse(params.deviceId);
    return validateApiOutput(pushTokenRemovalResultSchema, await removePushTokenForUser(user.id, deviceId));
  });
}
