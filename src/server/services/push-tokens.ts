import type {
  PushTokenRegistration,
  PushTokenRegistrationResult,
  PushTokenRemovalResult,
} from "@coffeebar/contracts";
import { getDb } from "@/lib/db";
import { ServiceConflictError } from "@/server/services/errors";

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export async function registerPushTokenForUser(
  userId: string,
  input: PushTokenRegistration,
): Promise<PushTokenRegistrationResult> {
  try {
    return await getDb().$transaction(async (tx) => {
      const [device, token] = await Promise.all([
        tx.devicePushToken.findUnique({
          where: { deviceId: input.deviceId },
          select: { id: true, userId: true, token: true },
        }),
        tx.devicePushToken.findUnique({
          where: { token: input.token },
          select: { id: true, userId: true, deviceId: true },
        }),
      ]);
      if (device && device.userId !== userId) {
        throw new ServiceConflictError("该设备已绑定其他账户");
      }
      if (token && (token.userId !== userId || token.deviceId !== input.deviceId)) {
        throw new ServiceConflictError("该推送令牌已被绑定");
      }
      const now = new Date();
      const row = device
        ? await tx.devicePushToken.update({
            where: { id: device.id },
            data: {
              token: input.token,
              environment: input.environment,
              disabledAt: null,
              disabledReason: null,
              lastSeenAt: now,
            },
            select: { updatedAt: true },
          })
        : await tx.devicePushToken.create({
            data: {
              userId,
              deviceId: input.deviceId,
              token: input.token,
              environment: input.environment,
              lastSeenAt: now,
            },
            select: { updatedAt: true },
          });
      return { registered: true, updatedAt: row.updatedAt.toISOString() };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (isUniqueConflict(error)) throw new ServiceConflictError("设备或推送令牌已被绑定");
    throw error;
  }
}

export async function removePushTokenForUser(userId: string, deviceId: string): Promise<PushTokenRemovalResult> {
  const result = await getDb().devicePushToken.deleteMany({ where: { userId, deviceId } });
  return { removed: result.count > 0 };
}
