import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./app/Root";
import { createMobileRuntime } from "./app/runtime";
import { createCatalogCache } from "./query/catalog-cache";
import { restoreCatalogQueries } from "./query/catalog-query";
import { createNetworkStore, observeNetwork } from "./state/network-store";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
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
    restoreCatalogQueries(queryClient, createCatalogCache(window.localStorage)),
  ]);
  await observeNetwork(network);
  const root = document.getElementById("root");
  if (!root) throw new Error("Mobile root element missing");
  createRoot(root).render(<StrictMode><Root auth={auth} queryClient={queryClient} /></StrictMode>);
}

void bootstrap();
