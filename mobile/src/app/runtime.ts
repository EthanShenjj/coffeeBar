import { QueryClient } from "@tanstack/react-query";
import { createAuthController } from "../auth/auth-controller";
import { createSessionTokenStore, type SessionTokenStore } from "../auth/session-token-store";
import { createApiClient } from "../lib/api-client";
import { getInstallationDeviceId } from "../config/device-id";
import { getSafeLocalStorage } from "../lib/safe-storage";

type RuntimeOptions = {
  apiBaseUrl: string;
  tokenStore?: SessionTokenStore;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  navigate?: (path: string, options?: { replace?: boolean }) => void;
  getCurrentPath?: () => string;
  queryClient?: QueryClient;
  deviceId?: string;
};

function browserNavigate(path: string, options?: { replace?: boolean }) {
  const method = options?.replace ? "replaceState" : "pushState";
  window.history[method](null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function clearSensitiveSessionQueries(queryClient: QueryClient) {
  const protectedRoots = new Set(["session", "dashboard", "member", "orders", "order", "gift-card", "giftCard"]);
  queryClient.removeQueries({
    predicate: (query) => query.meta?.sensitive === true || protectedRoots.has(String(query.queryKey[0] ?? "")),
  });
}

export function createMobileRuntime(options: RuntimeOptions) {
  const tokenStore = options.tokenStore ?? createSessionTokenStore();
  const queryClient = options.queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnReconnect: true } },
  });
  const auth = createAuthController({
    tokenStore,
    apiBaseUrl: options.apiBaseUrl,
    fetcher: options.fetcher,
    deviceId: options.deviceId ?? getInstallationDeviceId(getSafeLocalStorage()),
  });
  const api = createApiClient({
    baseUrl: options.apiBaseUrl,
    tokenStore,
    fetcher: options.fetcher,
    invalidateSession: auth.invalidateSession,
    clearSensitiveSessionQueries: () => clearSensitiveSessionQueries(queryClient),
    navigate: options.navigate ?? browserNavigate,
    getCurrentPath: options.getCurrentPath ?? (() => `${window.location.pathname}${window.location.search}`),
  });
  return { auth, api, queryClient, tokenStore };
}

export type MobileRuntime = ReturnType<typeof createMobileRuntime>;
