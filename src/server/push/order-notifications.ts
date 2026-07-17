import { getDb } from "@/lib/db";
import {
  loadApnsConfig,
  nodeApnsTransport,
  sendApnsNotification,
  type ApnsTransport,
  type OrderPushPayload,
} from "@/server/push/apns";

type OrderNotification = OrderPushPayload & { userId: string };
type SafeLogger = { warn(message: string, metadata: Record<string, string | number>): void };

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  async function consume() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => consume()));
}

export async function notifyOrderStatus(
  input: OrderNotification,
  dependencies: {
    env?: Parameters<typeof loadApnsConfig>[0];
    logger?: SafeLogger;
    transport?: ApnsTransport;
  } = {},
) {
  const logger = dependencies.logger ?? console;
  let config;
  try {
    config = loadApnsConfig(dependencies.env);
  } catch {
    logger.warn("APNs notification skipped", { orderId: input.orderId, category: "configuration" });
    return;
  }

  let tokens;
  try {
    tokens = await getDb().devicePushToken.findMany({
      where: { userId: input.userId, environment: config.environment, disabledAt: null },
      select: { id: true, token: true },
      take: 10,
    });
  } catch {
    logger.warn("APNs notification skipped", { orderId: input.orderId, category: "persistence" });
    return;
  }

  await runWithConcurrency(tokens, 3, async (token) => {
    try {
      const result = await sendApnsNotification(
        config,
        dependencies.transport ?? nodeApnsTransport,
        token.token,
        { orderId: input.orderId, orderNumber: input.orderNumber, status: input.status },
      );
      if (result.invalidToken) {
        await getDb().devicePushToken.updateMany({
          where: { id: token.id, userId: input.userId },
          data: { disabledAt: new Date(), disabledReason: result.reason },
        });
      } else if (!result.ok) {
        logger.warn("APNs notification rejected", {
          orderId: input.orderId, category: result.reason, status: result.status,
        });
      }
    } catch {
      logger.warn("APNs notification failed", { orderId: input.orderId, category: "transport" });
    }
  });
}
