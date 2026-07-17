import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { Root } from "./app/Root";
import { createMobileRuntime } from "./app/runtime";
import { createCatalogCache } from "./query/catalog-cache";
import { restoreCatalogQueries } from "./query/catalog-query";
import { createNetworkStore, observeNetwork } from "./state/network-store";
import { resolveApiBaseUrl } from "./config/api-base-url";
import { getSafeLocalStorage } from "./lib/safe-storage";
import { createCustomerApi } from "./lib/customer-api";
import { createCartStore } from "./state/cart-store";
import { createAnalyticsConsentStore } from "./analytics/consent-store";
import { browserAnalyticsVendors, createMobileAnalytics } from "./analytics/mobile-analytics";
import { createLocaleStore } from "./state/locale-store";
import { getInstallationDeviceId } from "./config/device-id";
import { createNativeExperience } from "./native/native-experience";
import "./styles.css";

const localStorage = getSafeLocalStorage();
const deviceId = getInstallationDeviceId(localStorage);
const apiBaseUrl = resolveApiBaseUrl({
  configured: import.meta.env.VITE_API_BASE_URL,
  fallbackOrigin: window.location.origin,
  native: Capacitor.isNativePlatform(),
  production: import.meta.env.PROD,
});
function browserNavigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export const mobileRuntime = createMobileRuntime({ apiBaseUrl, deviceId, navigate: browserNavigate });
const { auth, queryClient } = mobileRuntime;
const catalogCache = createCatalogCache(localStorage);
const network = createNetworkStore({
  initialOnline: navigator.onLine,
  onReconnect: async () => {
    await auth.restore();
    await queryClient.refetchQueries({ type: "active" });
  },
});
const consent = createAnalyticsConsentStore(localStorage);
const analytics = createMobileAnalytics({
  consent,
  vendors: browserAnalyticsVendors,
  config: {
    amplitudeKey: import.meta.env.VITE_AMPLITUDE_API_KEY,
    mixpanelToken: import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN,
    thinkingDataAppId: import.meta.env.VITE_THINKINGDATA_APP_ID,
    thinkingDataServerUrl: import.meta.env.VITE_THINKINGDATA_SERVER_URL,
  },
  appVersion: import.meta.env.VITE_APP_VERSION ?? "0.0.0",
  buildNumber: import.meta.env.VITE_BUILD_NUMBER ?? "0",
});
const customerApi = createCustomerApi(mobileRuntime.api, network);
const native = createNativeExperience({
  native: Capacitor.isNativePlatform(),
  api: customerApi,
  analytics,
  storage: localStorage,
  deviceId,
  environment: import.meta.env.VITE_APNS_ENVIRONMENT === "PRODUCTION" ? "PRODUCTION" : "DEVELOPMENT",
  navigate: browserNavigate,
  canRegisterPush: () => auth.getSnapshot().status === "authenticated",
});
const services = {
  api: mobileRuntime.api,
  customerApi,
  catalogCache,
  network,
  carts: { MENU: createCartStore("MENU", { storage: localStorage }), SHOP: createCartStore("SHOP", { storage: localStorage }) },
  consent,
  analytics,
  locale: createLocaleStore(localStorage),
  native,
};

async function bootstrap() {
  await Promise.all([
    auth.restore(),
    restoreCatalogQueries(queryClient, catalogCache),
  ]);
  disposeNetwork?.();
  try { disposeNetwork = await observeNetwork(network); } catch { disposeNetwork = undefined; }
  const root = document.getElementById("root");
  if (!root) throw new Error("Mobile root element missing");
  createRoot(root).render(<StrictMode><Root auth={auth} queryClient={queryClient} services={services} /></StrictMode>);
  try { disposeNative = await native.initialize(); } catch { disposeNative = undefined; }
}

let disposeNetwork: (() => void) | undefined;
let disposeNative: (() => Promise<void>) | undefined;
export function disposeMobileApp() {
  disposeNetwork?.();
  disposeNetwork = undefined;
  void disposeNative?.();
  disposeNative = undefined;
}

void bootstrap();

if (import.meta.hot) import.meta.hot.dispose(disposeMobileApp);
