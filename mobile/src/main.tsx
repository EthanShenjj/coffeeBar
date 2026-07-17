import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { createAuthController } from "./auth/auth-controller";
import { createSessionTokenStore } from "./auth/session-token-store";
import { Root } from "./app/Root";
import { createCatalogCache } from "./query/catalog-cache";
import { restoreCatalogQueries } from "./query/catalog-query";
import { createNetworkStore, observeNetwork } from "./state/network-store";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnReconnect: true } },
});
const auth = createAuthController({ tokenStore: createSessionTokenStore(), apiBaseUrl });
const network = createNetworkStore({ initialOnline: navigator.onLine, onReconnect: () => queryClient.refetchQueries({ type: "active" }) });

async function bootstrap() {
  await Promise.all([
    auth.restore(),
    restoreCatalogQueries(queryClient, createCatalogCache(window.localStorage)),
  ]);
  await observeNetwork(network);
  const root = document.getElementById("root");
  if (!root) throw new Error("Mobile root element missing");
  createRoot(root).render(<StrictMode><Root auth={auth} queryClient={queryClient} /></StrictMode>);
}

void bootstrap();
