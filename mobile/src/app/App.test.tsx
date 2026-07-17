import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { AuthController, AuthSnapshot } from "../auth/auth-controller";
import { createAnalyticsConsentStore } from "../analytics/consent-store";
import { createCatalogCache } from "../query/catalog-cache";
import { createCartStore } from "../state/cart-store";
import { createLocaleStore } from "../state/locale-store";
import { createNetworkStore } from "../state/network-store";
import type { AppServices } from "./services";
import { AppServicesProvider } from "./services";
import { AppRoutes } from "./App";

function setup(path: string, auth: AuthSnapshot, overrides: Partial<AppServices> = {}) {
  const controller = {
    signIn: vi.fn(async () => ({ id: "u1", name: "A", email: "a@example.com" })),
    signUp: vi.fn(async () => ({ id: "u1", name: "A", email: "a@example.com" })),
    signOut: vi.fn(async () => undefined), deleteAccount: vi.fn(async () => undefined),
  } as unknown as AuthController;
  const api = {
    get: vi.fn(async () => []), post: vi.fn(), put: vi.fn(), delete: vi.fn(), request: vi.fn(),
  } as unknown as AppServices["api"];
  const network = createNetworkStore({ initialOnline: true });
  const services: AppServices = {
    api,
    customerApi: {
      appConfig: vi.fn(async () => ({ minimumIosVersion: "1.0.0", maintenance: false, privacyUrl: "https://example.com/privacy", supportUrl: "https://example.com/support", apiVersion: "v1" })),
      announcements: vi.fn(async () => []), announcement: vi.fn(), dashboard: vi.fn(), orders: vi.fn(async () => []), order: vi.fn(), giftCard: vi.fn(), checkout: vi.fn(), recharge: vi.fn(), markAnnouncementRead: vi.fn(),
    } as unknown as AppServices["customerApi"],
    catalogCache: createCatalogCache(window.localStorage), network,
    carts: { MENU: createCartStore("MENU", { storage: window.localStorage }), SHOP: createCartStore("SHOP", { storage: window.localStorage }) },
    consent: createAnalyticsConsentStore(window.localStorage),
    analytics: { track: vi.fn(async () => undefined) },
    locale: createLocaleStore(window.localStorage),
    ...overrides,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<AppServicesProvider value={services}><QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><AppRoutes auth={auth} controller={controller} /></MemoryRouter></QueryClientProvider></AppServicesProvider>);
  return { services, controller, queryClient };
}

describe("mobile customer routes", () => {
  it.each([["/", "CoffeeBar"], ["/menu", "菜单"], ["/shop", "商店"], ["/cart/menu", "购物车"], ["/login", "登录"], ["/register", "注册"], ["/messages", "消息"]])("renders public route %s", (path, title) => {
    setup(path, { status: "anonymous", user: null });
    expect(screen.getByRole("heading", { name: new RegExp(title) })).toBeInTheDocument();
  });

  it("does not redirect a protected route while session restoration is pending", () => {
    setup("/orders", { status: "restoring", user: null });
    expect(screen.getByText("正在恢复登录状态…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "登录" })).not.toBeInTheDocument();
  });

  it("redirects anonymous protected routes and restores the intended route after login", async () => {
    const user = userEvent.setup(); const { controller } = setup("/orders/o1", { status: "anonymous", user: null });
    await waitFor(() => expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument());
    expect(window.sessionStorage.getItem("coffeebar.intended-route")).toBe("/orders/o1");
    await user.type(screen.getByLabelText("邮箱"), "a@example.com"); await user.type(screen.getByLabelText("密码"), "password1"); await user.click(screen.getByRole("button", { name: "登录" }));
    expect(controller.signIn).toHaveBeenCalledWith({ email: "a@example.com", password: "password1" });
    await waitFor(() => expect(controller.signIn).toHaveBeenCalledOnce());
  });

  it("switches the persistent interface locale", async () => {
    const user = userEvent.setup(); setup("/", { status: "anonymous", user: null });
    await user.click(screen.getByRole("button", { name: "Switch language" }));
    expect(screen.getAllByRole("link", { name: "Menu" })).toHaveLength(2);
    expect(window.localStorage.getItem("coffeebar.locale")).toBe("en");
  });

  it("registers with the auth controller and keeps server errors generic", async () => {
    const user = userEvent.setup(); const { controller } = setup("/register", { status: "anonymous", user: null });
    vi.mocked(controller.signUp).mockRejectedValueOnce(new Error("database stack secret"));
    await user.type(screen.getByLabelText("姓名"), "Alice"); await user.type(screen.getByLabelText("邮箱"), "alice@example.com"); await user.type(screen.getByLabelText("密码"), "password1");
    await user.click(screen.getByRole("button", { name: "注册" }));
    await waitFor(() => expect(controller.signUp).toHaveBeenCalledWith({ name: "Alice", email: "alice@example.com", password: "password1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("无法创建账户");
    expect(screen.getByRole("alert")).not.toHaveTextContent("database");
  });
});
