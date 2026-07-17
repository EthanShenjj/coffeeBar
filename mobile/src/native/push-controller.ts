import type { PushEnvironment, PushTokenRegistration, PushTokenRegistrationResult } from "@coffeebar/contracts";
import { parseCoffeeBarUrl } from "./deep-links";

const PUSH_PERMISSION_REQUESTED_KEY = "coffeebar.push-permission-requested";
const SAFE_RESOURCE_ID = /^[A-Za-z0-9_-]{1,200}$/;

type PermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";
type ListenerHandle = { remove(): Promise<void> };
export type PushPlugin = {
  checkPermissions(): Promise<{ receive: PermissionState }>;
  requestPermissions(): Promise<{ receive: PermissionState }>;
  register(): Promise<void>;
  addListener(event: string, listener: (value: never) => void): Promise<ListenerHandle>;
};
type PushApi = { registerPushToken(input: PushTokenRegistration): Promise<PushTokenRegistrationResult> };
type PushAnalytics = { track(event: string, properties?: Record<string, string | number | boolean>): Promise<void> };

function notificationDestination(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const action = value as { notification?: { data?: Record<string, unknown> } };
  const data = action.notification?.data;
  const orderId = typeof data?.orderId === "string" ? data.orderId : null;
  if (orderId && SAFE_RESOURCE_ID.test(orderId)) return { path: `/orders/${orderId}`, kind: "order" };
  const url = typeof data?.url === "string" ? data.url : typeof data?.deepLink === "string" ? data.deepLink : null;
  const path = url ? parseCoffeeBarUrl(url) : null;
  if (!path) return null;
  return { path, kind: path.startsWith("/orders/") ? "order" : "message" };
}

export function createPushController(options: {
  push: PushPlugin;
  api: PushApi;
  analytics: PushAnalytics;
  storage: Pick<Storage, "getItem" | "setItem">;
  deviceId: string;
  environment: PushEnvironment;
  navigate(path: string): void;
  canRegister?: () => boolean;
}) {
  let initialized = false;
  let handles: ListenerHandle[] = [];
  let registrationRequested = false;

  async function register() {
    if (registrationRequested) return;
    registrationRequested = true;
    try {
      await options.push.register();
    } catch {
      registrationRequested = false;
    }
  }

  async function initialize() {
    if (initialized) return async () => undefined;
    initialized = true;
    handles = await Promise.all([
      options.push.addListener("registration", ((value: { value?: unknown }) => {
        if (typeof value.value !== "string" || options.canRegister?.() === false) return;
        void options.api.registerPushToken({ token: value.value, deviceId: options.deviceId, environment: options.environment }).catch(() => undefined);
      }) as (value: never) => void),
      options.push.addListener("registrationError", (() => {
        registrationRequested = false;
      }) as (value: never) => void),
      options.push.addListener("pushNotificationActionPerformed", ((value: unknown) => {
        const destination = notificationDestination(value);
        if (!destination) return;
        options.navigate(destination.path);
        void options.analytics.track("push_opened", { destination: destination.kind });
      }) as (value: never) => void),
    ]);
    try {
      if (options.storage.getItem(PUSH_PERMISSION_REQUESTED_KEY) === "1") {
        const permission = await options.push.checkPermissions();
        if (permission.receive === "granted") await register();
      }
    } catch {
      // Push initialization is best effort and never blocks the customer flow.
    }
    return async () => {
      const current = handles;
      handles = [];
      initialized = false;
      await Promise.all(current.map((handle) => handle.remove().catch(() => undefined)));
    };
  }

  async function requestAfterFirstOrder() {
    let alreadyRequested = false;
    try {
      alreadyRequested = options.storage.getItem(PUSH_PERMISSION_REQUESTED_KEY) === "1";
      if (!alreadyRequested) options.storage.setItem(PUSH_PERMISSION_REQUESTED_KEY, "1");
    } catch {
      return;
    }
    if (alreadyRequested) {
      try {
        const permission = await options.push.checkPermissions();
        if (permission.receive === "granted" && options.canRegister?.() !== false) await register();
      } catch { /* best effort */ }
      return;
    }
    await options.analytics.track("push_permission_requested");
    try {
      const permission = await options.push.requestPermissions();
      if (permission.receive === "granted") {
        await options.analytics.track("push_permission_granted");
        if (options.canRegister?.() !== false) await register();
      } else {
        await options.analytics.track("push_permission_denied");
      }
    } catch {
      await options.analytics.track("push_permission_denied");
    }
  }

  return { initialize, requestAfterFirstOrder };
}
