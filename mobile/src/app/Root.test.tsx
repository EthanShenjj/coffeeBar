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
    customerApi: { announcements: vi.fn(async () => []) }, catalogCache: createCatalogCache(window.localStorage), network,
    carts: { MENU: createCartStore("MENU", { storage: window.localStorage }), SHOP: createCartStore("SHOP", { storage: window.localStorage }) },
    consent, analytics: { track: vi.fn(async () => undefined) }, locale: createLocaleStore(window.localStorage),
  } as unknown as AppServices;
  const authSnapshot = { status: "anonymous", user: null } as const;
  const auth = { getSnapshot: () => authSnapshot, subscribe: () => () => true } as unknown as AuthController;
  const user = userEvent.setup(); render(<Root auth={auth} queryClient={new QueryClient()} services={services} />);
  expect(screen.getByRole("heading", { name: /帮助我们改善/ })).toBeInTheDocument(); expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "暂不允许" }));
  expect(screen.getByRole("heading", { name: /CoffeeBar/ })).toBeInTheDocument(); expect(services.analytics.track).not.toHaveBeenCalled();
});
