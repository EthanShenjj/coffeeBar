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
import "./styles.css";

const apiBaseUrl = resolveApiBaseUrl({
  configured: import.meta.env.VITE_API_BASE_URL,
  fallbackOrigin: window.location.origin,
  native: Capacitor.isNativePlatform(),
  production: import.meta.env.PROD,
});
export const mobileRuntime = createMobileRuntime({ apiBaseUrl });
const { auth, queryClient } = mobileRuntime;
const network = createNetworkStore({
  initialOnline: navigator.onLine,
  onReconnect: async () => {
    await auth.restore();
    await queryClient.refetchQueries({ type: "active" });
  },
});

async function bootstrap() {
  await Promise.all([
    auth.restore(),
    restoreCatalogQueries(queryClient, createCatalogCache(getSafeLocalStorage())),
  ]);
  disposeNetwork?.();
  try { disposeNetwork = await observeNetwork(network); } catch { disposeNetwork = undefined; }
  const root = document.getElementById("root");
  if (!root) throw new Error("Mobile root element missing");
  createRoot(root).render(<StrictMode><Root auth={auth} queryClient={queryClient} /></StrictMode>);
}

let disposeNetwork: (() => void) | undefined;
export function disposeMobileApp() {
  disposeNetwork?.();
  disposeNetwork = undefined;
}

void bootstrap();

if (import.meta.hot) import.meta.hot.dispose(disposeMobileApp);
