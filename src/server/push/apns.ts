import { connect, constants } from "node:http2";
import { createHash } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";

export type ApnsEnvironment = "DEVELOPMENT" | "PRODUCTION";

export type ApnsConfig = {
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
  environment: ApnsEnvironment;
  host: "api.sandbox.push.apple.com" | "api.push.apple.com";
};

export type ApnsRequest = {
  host: ApnsConfig["host"];
  path: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
};

export type ApnsResponse = { status: number; body: string };
export type ApnsTransport = { send(request: ApnsRequest): Promise<ApnsResponse> };

type ApnsEnvironmentVariables = {
  APNS_TEAM_ID?: string;
  APNS_KEY_ID?: string;
  APNS_PRIVATE_KEY_BASE64?: string;
  APNS_BUNDLE_ID?: string;
  APNS_ENVIRONMENT?: string;
};

const invalidConfig = () => new Error("APNs configuration is invalid");

export function loadApnsConfig(env: ApnsEnvironmentVariables = process.env as ApnsEnvironmentVariables): ApnsConfig {
  const teamId = env.APNS_TEAM_ID?.trim();
  const keyId = env.APNS_KEY_ID?.trim();
  const bundleId = env.APNS_BUNDLE_ID?.trim();
  const rawEnvironment = env.APNS_ENVIRONMENT?.trim().toLowerCase();
  let privateKey = "";
  try {
    privateKey = Buffer.from(env.APNS_PRIVATE_KEY_BASE64 ?? "", "base64").toString("utf8");
  } catch {
    throw invalidConfig();
  }
  if (!teamId || !keyId || !bundleId || !privateKey.includes("BEGIN PRIVATE KEY") ||
      (rawEnvironment !== "development" && rawEnvironment !== "production")) {
    throw invalidConfig();
  }
  const environment = rawEnvironment === "production" ? "PRODUCTION" : "DEVELOPMENT";
  return {
    teamId,
    keyId,
    bundleId,
    privateKey,
    environment,
    host: environment === "PRODUCTION" ? "api.push.apple.com" : "api.sandbox.push.apple.com",
  };
}

export async function createApnsProviderToken(config: ApnsConfig, now = new Date()) {
  let key;
  try {
    key = await importPKCS8(config.privateKey, "ES256");
  } catch {
    throw new Error("APNs signing key is invalid");
  }
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .sign(key);
}

const PROVIDER_TOKEN_CACHE_MS = 50 * 60_000;
const providerTokenCache = new Map<string, { issuedAt: number; token: Promise<string> }>();

function providerTokenCacheKey(config: ApnsConfig) {
  return createHash("sha256").update(JSON.stringify({
    teamId: config.teamId,
    keyId: config.keyId,
    privateKey: config.privateKey,
    bundleId: config.bundleId,
    environment: config.environment,
  })).digest("hex");
}

export function getCachedApnsProviderToken(config: ApnsConfig, now = new Date()) {
  const cacheKey = providerTokenCacheKey(config);
  const nowMs = now.getTime();
  const cached = providerTokenCache.get(cacheKey);
  if (cached && nowMs >= cached.issuedAt && nowMs - cached.issuedAt < PROVIDER_TOKEN_CACHE_MS) {
    return cached.token;
  }
  const token = createApnsProviderToken(config, now);
  providerTokenCache.set(cacheKey, { issuedAt: nowMs, token });
  void token.catch(() => {
    if (providerTokenCache.get(cacheKey)?.token === token) providerTokenCache.delete(cacheKey);
  });
  return token;
}

export type OrderPushPayload = {
  orderId: string;
  orderNumber: string;
  status: "PREPARING" | "READY" | "COMPLETED";
};

const statusBody: Record<OrderPushPayload["status"], string> = {
  PREPARING: "您的订单已开始制作",
  READY: "您的订单已可取货",
  COMPLETED: "您的订单已完成",
};

export async function createApnsRequest(
  config: ApnsConfig,
  deviceToken: string,
  payload: OrderPushPayload,
): Promise<ApnsRequest> {
  const authorization = await getCachedApnsProviderToken(config);
  return {
    host: config.host,
    path: `/3/device/${deviceToken}`,
    timeoutMs: 10_000,
    headers: {
      authorization: `bearer ${authorization}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: `CoffeeBar 订单 ${payload.orderNumber}`, body: statusBody[payload.status] },
        sound: "default",
      },
      orderId: payload.orderId,
      orderStatus: payload.status,
      deepLink: `coffeebar://orders/${encodeURIComponent(payload.orderId)}`,
    }),
  };
}

const knownReasons = new Set([
  "BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic", "ExpiredProviderToken",
  "InvalidProviderToken", "TooManyProviderTokenUpdates", "PayloadEmpty", "PayloadTooLarge",
  "TopicDisallowed", "TooManyRequests", "InternalServerError", "ServiceUnavailable", "Shutdown",
]);

function responseReason(body: string) {
  try {
    const reason = JSON.parse(body) as { reason?: unknown };
    return typeof reason.reason === "string" && knownReasons.has(reason.reason) ? reason.reason : "APNS_REJECTED";
  } catch {
    return "APNS_REJECTED";
  }
}

export async function sendApnsNotification(
  config: ApnsConfig,
  transport: ApnsTransport,
  deviceToken: string,
  payload: OrderPushPayload,
) {
  const response = await transport.send(await createApnsRequest(config, deviceToken, payload));
  if (response.status === 200) return { ok: true as const, status: 200, invalidToken: false as const };
  const reason = responseReason(response.body);
  return {
    ok: false as const,
    status: response.status,
    reason,
    invalidToken: response.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered",
  };
}

type ApnsHttp2Stream = {
  setEncoding(encoding: string): unknown;
  on(event: "response", listener: (headers: Record<string, unknown>) => void): unknown;
  on(event: "data", listener: (chunk: string) => void): unknown;
  once(event: "end" | "error", listener: () => void): unknown;
  end(body: string): unknown;
  close(): unknown;
  destroy(): unknown;
};

type ApnsHttp2Session = {
  once(event: "error", listener: () => void): unknown;
  request(headers: Record<string, string>): ApnsHttp2Stream;
  close(): unknown;
  destroy(): unknown;
};

type NodeApnsTransportDependencies = {
  connect(authority: string): ApnsHttp2Session;
  scheduleTimeout(callback: () => void, timeoutMs: number): unknown;
  cancelTimeout(handle: unknown): void;
};

const defaultTransportDependencies: NodeApnsTransportDependencies = {
  connect: (authority) => connect(authority) as unknown as ApnsHttp2Session,
  scheduleTimeout: (callback, timeoutMs) => setTimeout(callback, timeoutMs),
  cancelTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createNodeApnsTransport(
  dependencies: NodeApnsTransportDependencies = defaultTransportDependencies,
): ApnsTransport {
  return { send(request) {
    return new Promise((resolve, reject) => {
      let client: ApnsHttp2Session | undefined;
      let stream: ApnsHttp2Stream | undefined;
      let timer: unknown;
      let settled = false;
      const finish = (result: ApnsResponse | Error, destroy: boolean) => {
        if (settled) return;
        settled = true;
        try {
          if (timer !== undefined) dependencies.cancelTimeout(timer);
        } catch {
          // Cleanup errors must not change the transport result.
        }
        if (destroy) {
          try { stream?.destroy(); } catch { /* continue closing the session */ }
          try { client?.destroy(); } catch { /* settle below */ }
        } else {
          try { stream?.close(); } catch { /* continue closing the session */ }
          try { client?.close(); } catch { /* settle below */ }
        }
        if (result instanceof Error) reject(new Error("APNs transport failed"));
        else resolve(result);
      };
      try {
        client = dependencies.connect(`https://${request.host}`);
        client.once("error", () => finish(new Error("connection"), true));
        stream = client.request({
          [constants.HTTP2_HEADER_METHOD]: "POST",
          [constants.HTTP2_HEADER_PATH]: request.path,
          ...request.headers,
        });
        let status = 0;
        let body = "";
        stream.setEncoding("utf8");
        stream.on("response", (headers) => {
          status = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0);
        });
        stream.on("data", (chunk: string) => {
          if (body.length < 8192) body += chunk.slice(0, 8192 - body.length);
        });
        stream.once("end", () => finish({ status, body }, false));
        stream.once("error", () => finish(new Error("stream"), true));
        timer = dependencies.scheduleTimeout(() => finish(new Error("timeout"), true), request.timeoutMs);
        stream.end(request.body);
      } catch {
        finish(new Error("request"), true);
      }
    });
  } };
}

export const nodeApnsTransport = createNodeApnsTransport();
