import { App } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import type { PushEnvironment } from "@coffeebar/contracts";
import type { MobileAnalytics } from "../analytics/mobile-analytics";
import type { CustomerApi } from "../lib/customer-api";
import { initializeDeepLinks } from "./deep-links";
import { createPushController, type PushPlugin } from "./push-controller";

export type NativeExperience = {
  initialize(): Promise<() => Promise<void>>;
  addedToCart(): Promise<void>;
  orderSucceeded(): Promise<void>;
  operationFailed(): Promise<void>;
  requestPushAfterFirstOrder(): Promise<void>;
};

export function createNativeExperience(options: {
  native: boolean;
  api: Pick<CustomerApi, "registerPushToken">;
  analytics: MobileAnalytics;
  storage: Pick<Storage, "getItem" | "setItem">;
  deviceId: string;
  environment: PushEnvironment;
  navigate(path: string): void;
  canRegisterPush?: () => boolean;
}): NativeExperience {
  if (!options.native) {
    const noop = async () => undefined;
    return { initialize: async () => noop, addedToCart: noop, orderSucceeded: noop, operationFailed: noop, requestPushAfterFirstOrder: noop };
  }

  const push = createPushController({
    push: PushNotifications as unknown as PushPlugin,
    api: options.api,
    analytics: options.analytics,
    storage: options.storage,
    deviceId: options.deviceId,
    environment: options.environment,
    navigate: options.navigate,
    canRegister: options.canRegisterPush,
  });

  return {
    async initialize() {
      const disposers: Array<() => Promise<void>> = [];
      try { disposers.push(await initializeDeepLinks({ app: App, navigate: options.navigate })); } catch { /* deep links are best effort */ }
      try { disposers.push(await push.initialize()); } catch { /* push is best effort */ }
      try { await SplashScreen.hide(); } catch { /* configured auto-hide remains available */ }
      return async () => { await Promise.all(disposers.map((dispose) => dispose())); };
    },
    async addedToCart() {
      try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* browser and unsupported devices are silent */ }
    },
    async orderSucceeded() {
      try { await Haptics.notification({ type: NotificationType.Success }); } catch { /* best effort */ }
    },
    async operationFailed() {
      try { await Haptics.notification({ type: NotificationType.Error }); } catch { /* best effort */ }
    },
    requestPushAfterFirstOrder: push.requestAfterFirstOrder,
  };
}
