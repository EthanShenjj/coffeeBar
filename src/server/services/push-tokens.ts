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

function isTransactionConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2034");
}

const MAX_ACTIVE_PUSH_DEVICES = 10;
const MAX_TRANSACTION_ATTEMPTS = 3;

export async function registerPushTokenForUser(
  userId: string,
  input: PushTokenRegistration,
): Promise<PushTokenRegistrationResult> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await getDb().$transaction(async (tx) => {
        const device = await tx.devicePushToken.findUnique({
          where: { deviceId: input.deviceId },
          select: { id: true, userId: true, token: true, disabledAt: true },
        });
        const token = await tx.devicePushToken.findUnique({
          where: { token: input.token },
          select: { id: true, userId: true, deviceId: true },
        });
        if (device && device.userId !== userId) {
          throw new ServiceConflictError("该设备已绑定其他账户");
        }
        if (token && (token.userId !== userId || token.deviceId !== input.deviceId)) {
          throw new ServiceConflictError("该推送令牌已被绑定");
        }
        if (!device || device.disabledAt) {
          const activeDevices = await tx.devicePushToken.count({ where: { userId, disabledAt: null } });
          if (activeDevices >= MAX_ACTIVE_PUSH_DEVICES) {
            throw new ServiceConflictError("已达到推送设备数量上限");
          }
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
      if (isTransactionConflict(error)) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS) continue;
        throw new ServiceConflictError("设备绑定冲突，请重试");
      }
      if (isUniqueConflict(error)) throw new ServiceConflictError("设备或推送令牌已被绑定");
      throw error;
    }
  }
  throw new ServiceConflictError("设备绑定冲突，请重试");
}

export async function removePushTokenForUser(userId: string, deviceId: string): Promise<PushTokenRemovalResult> {
  const result = await getDb().devicePushToken.deleteMany({ where: { userId, deviceId } });
  return { removed: result.count > 0 };
}
