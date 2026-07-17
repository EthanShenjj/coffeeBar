import { createContext, useContext, type ReactNode } from "react";
import type { ApiClient } from "../lib/api-client";
import type { CustomerApi } from "../lib/customer-api";
import type { CatalogCache } from "../query/catalog-cache";
import type { CartStore } from "../state/cart-store";
import type { createNetworkStore } from "../state/network-store";
import type { AnalyticsConsentStore } from "../analytics/consent-store";
import type { MobileAnalytics } from "../analytics/mobile-analytics";
import type { LocaleStore } from "../state/locale-store";
import type { NativeExperience } from "../native/native-experience";

export type AppServices = {
  api: ApiClient;
  customerApi: CustomerApi;
  catalogCache: CatalogCache;
  network: ReturnType<typeof createNetworkStore>;
  carts: Record<"MENU" | "SHOP", CartStore>;
  consent: AnalyticsConsentStore;
  analytics: MobileAnalytics;
  locale: LocaleStore;
  native?: NativeExperience;
};

const ServicesContext = createContext<AppServices | null>(null);
export function AppServicesProvider({ value, children }: { value: AppServices; children: ReactNode }) {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}
export function useAppServices() {
  const value = useContext(ServicesContext);
  if (!value) throw new Error("Mobile app services are unavailable");
  return value;
}
