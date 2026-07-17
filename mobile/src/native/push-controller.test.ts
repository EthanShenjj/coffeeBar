import { describe, expect, it, vi } from "vitest";
import { createPushController } from "./push-controller";

function makePushPlugin(permission: "prompt" | "granted" | "denied" = "prompt") {
  const listeners = new Map<string, (value: never) => void>();
  return {
    listeners,
    plugin: {
      checkPermissions: vi.fn(async () => ({ receive: permission })),
      requestPermissions: vi.fn(async () => ({ receive: permission === "prompt" ? "granted" as const : permission })),
      register: vi.fn(async () => undefined),
      addListener: vi.fn(async (event: string, listener: (value: never) => void) => {
        listeners.set(event, listener);
        return { remove: vi.fn(async () => undefined) };
      }),
    },
  };
}

describe("native push controller", () => {
  it("waits until the first successful order before requesting permission", async () => {
    const push = makePushPlugin();
    const storage = window.localStorage;
    const api = { registerPushToken: vi.fn(async () => ({ registered: true, updatedAt: new Date().toISOString() })) };
    const analytics = { track: vi.fn(async () => undefined) };
    const controller = createPushController({ push: push.plugin, api, analytics, storage, deviceId: "device-1", environment: "DEVELOPMENT", navigate: vi.fn() });

    const dispose = await controller.initialize();
    expect(push.plugin.requestPermissions).not.toHaveBeenCalled();

    await controller.requestAfterFirstOrder();
    expect(push.plugin.requestPermissions).toHaveBeenCalledOnce();
    expect(push.plugin.register).toHaveBeenCalledOnce();
    expect(analytics.track).toHaveBeenCalledWith("push_permission_requested");
    expect(analytics.track).toHaveBeenCalledWith("push_permission_granted");

    await controller.requestAfterFirstOrder();
    expect(push.plugin.requestPermissions).toHaveBeenCalledOnce();
    await dispose();
  });

  it("registers APNs tokens without exposing them to analytics and routes notification opens", async () => {
    const push = makePushPlugin("granted");
    window.localStorage.setItem("coffeebar.push-permission-requested", "1");
    const api = { registerPushToken: vi.fn(async () => ({ registered: true, updatedAt: new Date().toISOString() })) };
    const analytics = { track: vi.fn(async () => undefined) };
    const navigate = vi.fn();
    const controller = createPushController({ push: push.plugin, api, analytics, storage: window.localStorage, deviceId: "device-1", environment: "PRODUCTION", navigate });
    await controller.initialize();

    const token = "a".repeat(64);
    push.listeners.get("registration")?.({ value: token } as never);
    await vi.waitFor(() => expect(api.registerPushToken).toHaveBeenCalledWith({ token, deviceId: "device-1", environment: "PRODUCTION" }));
    expect(JSON.stringify(analytics.track.mock.calls)).not.toContain(token);

    push.listeners.get("pushNotificationActionPerformed")?.({ notification: { data: { orderId: "order-9" } } } as never);
    expect(navigate).toHaveBeenCalledWith("/orders/order-9");
    expect(analytics.track).toHaveBeenCalledWith("push_opened", { destination: "order" });
  });

  it("records denial and does not register for remote notifications", async () => {
    const push = makePushPlugin("denied");
    const analytics = { track: vi.fn(async () => undefined) };
    const controller = createPushController({ push: push.plugin, api: { registerPushToken: vi.fn() }, analytics, storage: window.localStorage, deviceId: "device-1", environment: "DEVELOPMENT", navigate: vi.fn() });
    await controller.initialize();
    await controller.requestAfterFirstOrder();
    expect(analytics.track).toHaveBeenCalledWith("push_permission_denied");
    expect(push.plugin.register).not.toHaveBeenCalled();
  });
});
