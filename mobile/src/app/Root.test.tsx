import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import type { AuthController } from "../auth/auth-controller";
import { createAnalyticsConsentStore } from "../analytics/consent-store";
import { createCatalogCache } from "../query/catalog-cache";
import { createCartStore } from "../state/cart-store";
import { createLocaleStore } from "../state/locale-store";
import { createNetworkStore } from "../state/network-store";
import type { AppServices } from "./services";
import { Root } from "./Root";

it("blocks the application behind the first-launch analytics choice", async () => {
  const consent = createAnalyticsConsentStore(window.localStorage);
  const network = createNetworkStore({ initialOnline: true });
  const services = {
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), request: vi.fn() },
    customerApi: { appConfig: vi.fn(async () => ({ minimumIosVersion: "1.0.0", maintenance: false, privacyUrl: "https://example.com/privacy", supportUrl: "https://example.com/support", apiVersion: "v1" })), announcements: vi.fn(async () => []) }, catalogCache: createCatalogCache(window.localStorage), network,
    carts: { MENU: createCartStore("MENU", { storage: window.localStorage }), SHOP: createCartStore("SHOP", { storage: window.localStorage }) },
    consent, analytics: { track: vi.fn(async () => undefined) }, locale: createLocaleStore(window.localStorage),
  } as unknown as AppServices;
  const authSnapshot = { status: "anonymous", user: null } as const;
  const auth = { getSnapshot: () => authSnapshot, subscribe: () => () => true } as unknown as AuthController;
  const user = userEvent.setup(); render(<Root auth={auth} queryClient={new QueryClient()} services={services} />);
  expect(screen.getByRole("heading", { name: /帮助我们改善/ })).toBeInTheDocument(); expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "暂不允许" }));
  expect(await screen.findByRole("heading", { name: /CoffeeBar/ })).toBeInTheDocument();
  expect(services.analytics.track).not.toHaveBeenCalledWith("analytics_consent", expect.anything());
});

async function configuredRoot(config: { minimumIosVersion: string; maintenance: boolean }) {
  const consent = createAnalyticsConsentStore(window.localStorage);
  await consent.getState().decide(false);
  const services = {
    api: {},
    customerApi: { appConfig: vi.fn(async () => ({ ...config, privacyUrl: "https://example.com/privacy", supportUrl: "https://example.com/support", apiVersion: "v1" })) },
    catalogCache: createCatalogCache(window.localStorage), network: createNetworkStore({ initialOnline: true }),
    carts: { MENU: createCartStore("MENU", { storage: window.localStorage }), SHOP: createCartStore("SHOP", { storage: window.localStorage }) },
    consent, analytics: { track: vi.fn(async () => undefined) }, locale: createLocaleStore(window.localStorage),
    nativePlatform: true, appVersion: "1.0.0",
  } as unknown as AppServices;
  const snapshot = { status: "anonymous", user: null } as const;
  const auth = { getSnapshot: () => snapshot, subscribe: () => () => true } as unknown as AuthController;
  render(<Root auth={auth} queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })} services={services} />);
}

it("blocks a maintained mobile app before customer routes load", async () => {
  await configuredRoot({ minimumIosVersion: "1.0.0", maintenance: true });
  expect(await screen.findByRole("heading", { name: "CoffeeBar 正在维护" })).toBeInTheDocument();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

it("requires a TestFlight update below the configured minimum version", async () => {
  await configuredRoot({ minimumIosVersion: "1.1.0", maintenance: false });
  expect(await screen.findByRole("heading", { name: "需要更新 CoffeeBar" })).toBeInTheDocument();
  expect(screen.getByText(/TestFlight/)).toBeInTheDocument();
});

it("offers the privacy choice in English before analytics can initialize", async () => {
  const consent = createAnalyticsConsentStore(window.localStorage);
  const services = {
    api: {}, customerApi: {}, catalogCache: createCatalogCache(window.localStorage), network: createNetworkStore({ initialOnline: true }),
    carts: { MENU: createCartStore("MENU", { storage: window.localStorage }), SHOP: createCartStore("SHOP", { storage: window.localStorage }) },
    consent, analytics: { track: vi.fn(async () => undefined) }, locale: createLocaleStore(window.localStorage),
  } as unknown as AppServices;
  const snapshot = { status: "anonymous", user: null } as const;
  const auth = { getSnapshot: () => snapshot, subscribe: () => () => true } as unknown as AuthController;
  const user = userEvent.setup(); render(<Root auth={auth} queryClient={new QueryClient()} services={services} />);
  await user.click(screen.getByRole("button", { name: "语言切换" }));
  expect(screen.getByRole("heading", { name: "Help us improve CoffeeBar?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Allow analytics" })).toBeInTheDocument();
  expect(services.analytics.track).not.toHaveBeenCalled();
});
