import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { CheckoutRequestInput, CheckoutResult, ProductView } from "@coffeebar/contracts";
import type { AuthController, AuthSnapshot } from "../auth/auth-controller";
import { createAnalyticsConsentStore } from "../analytics/consent-store";
import { ApiClientError } from "../lib/api-client";
import { createCatalogCache } from "../query/catalog-cache";
import { createCartStore } from "../state/cart-store";
import { createLocaleStore } from "../state/locale-store";
import { createNetworkStore } from "../state/network-store";
import { AppRoutes } from "./App";
import { AppServicesProvider, type AppServices } from "./services";

const latte: ProductView = {
  id: "latte", slug: "latte", name: "Latte", subtitle: "Milk coffee", description: "Espresso and milk", channel: "MENU", category: "Coffee", menuCollection: "CLASSIC", menuSection: "Espresso", price: 3200, imageUrl: "", stock: 8, isAvailable: true,
  optionGroups: [{ id: "temp", name: "温度", required: true, maxSelect: 1, options: [{ id: "hot", name: "热", priceDelta: 0 }, { id: "ice", name: "冰", priceDelta: 200 }] }],
};

function renderFlow(path: string, options: { auth?: AuthSnapshot; online?: boolean; api?: Partial<AppServices["customerApi"]>; products?: ProductView[] } = {}) {
  const auth = options.auth ?? { status: "authenticated", user: { id: "u1", name: "A", email: "a@example.com" } };
  const controller = { signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(async () => undefined), deleteAccount: vi.fn(async () => undefined) } as unknown as AuthController;
  const network = createNetworkStore({ initialOnline: options.online ?? true });
  const rawApi = { get: vi.fn(async () => options.products ?? []), post: vi.fn(), put: vi.fn(), delete: vi.fn(), request: vi.fn() } as unknown as AppServices["api"];
  const customerApi = {
    appConfig: vi.fn(async () => ({ minimumIosVersion: "1.0.0", maintenance: false, privacyUrl: "https://example.com/privacy", supportUrl: "https://example.com/support", apiVersion: "v1" })),
    announcements: vi.fn(async () => []), announcement: vi.fn(), dashboard: vi.fn(), orders: vi.fn(async () => []), order: vi.fn(), giftCard: vi.fn(), checkout: vi.fn(), recharge: vi.fn(), markAnnouncementRead: vi.fn(), ...options.api,
  } as unknown as AppServices["customerApi"];
  const services: AppServices = {
    api: rawApi, customerApi, network, catalogCache: createCatalogCache(window.localStorage),
    carts: { MENU: createCartStore("MENU", { storage: window.localStorage }), SHOP: createCartStore("SHOP", { storage: window.localStorage }) },
    consent: createAnalyticsConsentStore(window.localStorage), analytics: { track: vi.fn(async () => undefined) }, locale: createLocaleStore(window.localStorage),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<AppServicesProvider value={services}><QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><AppRoutes auth={auth} controller={controller} /></MemoryRouter></QueryClientProvider></AppServicesProvider>);
  return { services, controller, queryClient };
}

describe("mobile catalog, carts and checkout", () => {
  it("validates required specs and keeps menu/shop carts isolated", async () => {
    const user = userEvent.setup(); const { services } = renderFlow("/menu", { products: [latte] });
    await user.click(await screen.findByRole("button", { name: /Latte/ }));
    await user.click(screen.getByRole("button", { name: "加入购物车" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请选择必选规格");
    await user.click(screen.getByLabelText("热"));
    await user.click(screen.getByRole("button", { name: "加入购物车" }));
    expect(services.carts.MENU.getState().items).toHaveLength(1);
    expect(services.carts.SHOP.getState().items).toHaveLength(0);
  });

  it("stores direct buy separately without changing either cart", async () => {
    const user = userEvent.setup(); const { services } = renderFlow("/menu", { products: [latte] });
    await user.click(await screen.findByRole("button", { name: /Latte/ })); await user.click(screen.getByRole("radio", { name: /冰/ })); await user.click(screen.getByRole("button", { name: "直接购买" }));
    expect(JSON.parse(window.sessionStorage.getItem("coffeebar.direct")!)).toMatchObject({ product: { id: "latte" }, optionIds: ["ice"] });
    expect(services.carts.MENU.getState().items).toHaveLength(0); expect(services.carts.SHOP.getState().items).toHaveLength(0);
  });

  it("disables checkout offline and submits one idempotent request on double tap", async () => {
    const offline = renderFlow("/checkout?kind=MENU", { online: false }); offline.services.carts.MENU.getState().addItem(latte, ["hot"]);
    expect(screen.getByRole("button", { name: "确认下单" })).toBeDisabled();
  });

  it("uses one UUID, prevents duplicate submission, clears the matching cart on success", async () => {
    let resolve!: (value: CheckoutResult) => void;
    const checkout = vi.fn<(input: CheckoutRequestInput) => Promise<CheckoutResult>>(() => new Promise<CheckoutResult>((done) => { resolve = done; }));
    const user = userEvent.setup(); const { services } = renderFlow("/checkout?kind=MENU", { api: { checkout } }); services.carts.MENU.getState().addItem(latte, ["hot"]);
    await user.type(screen.getByLabelText("取货人"), "Alice");
    const button = screen.getByRole("button", { name: "确认下单" }); await user.dblClick(button);
    expect(checkout).toHaveBeenCalledOnce(); expect(checkout.mock.calls[0]![0].token).toMatch(/^[0-9a-f-]{36}$/);
    resolve({ ok: true, orderId: "o1", orderNumber: "CB001", totalAmount: 3200, giftCardAmount: 0, externalAmount: 3200, demo: true });
    expect(await screen.findByRole("heading", { name: "下单成功" })).toBeInTheDocument();
    expect(services.carts.MENU.getState().items).toHaveLength(0);
  });

  it("shows actionable conflict copy and retains the cart", async () => {
    const checkout = vi.fn(async () => { throw new ApiClientError("CONFLICT", "internal stock", 409); });
    const user = userEvent.setup(); const { services } = renderFlow("/checkout?kind=MENU", { api: { checkout } }); services.carts.MENU.getState().addItem(latte, ["hot"]);
    await user.type(screen.getByLabelText("取货人"), "Alice"); await user.click(screen.getByRole("button", { name: "确认下单" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("返回购物车确认后重试"); expect(services.carts.MENU.getState().items).toHaveLength(1);
  });

  it("does not clear cart edits made while a checkout response is in flight", async () => {
    let resolve!: (value: CheckoutResult) => void;
    const checkout = vi.fn<(input: CheckoutRequestInput) => Promise<CheckoutResult>>(() => new Promise((done) => { resolve = done; }));
    const user = userEvent.setup(); const { services } = renderFlow("/checkout?kind=MENU", { api: { checkout } }); services.carts.MENU.getState().addItem(latte, ["hot"]);
    await user.type(screen.getByLabelText("取货人"), "Alice"); await user.click(screen.getByRole("button", { name: "确认下单" }));
    services.carts.MENU.getState().addItem(latte, ["hot"]);
    resolve({ ok: true, orderId: "o1", orderNumber: "CB001", totalAmount: 3200, giftCardAmount: 0, externalAmount: 3200, demo: true });
    await screen.findByRole("heading", { name: "下单成功" }); expect(services.carts.MENU.getState().items[0]?.quantity).toBe(2);
  });
});

describe("mobile customer data and privacy", () => {
  it("renders member, orders and gift-card data as sensitive queries", async () => {
    const dashboard = vi.fn(async () => ({ user: { name: "Alice", email: "a@example.com", role: "CUSTOMER" }, giftCardBalance: 1000, totalPaid: 3200, monthPaid: 3200, orderCount: 1, average: 3200, level: { level: 1, currentThreshold: 0, nextThreshold: 10000, progress: 32 }, months: [10], coffeeDays: [], today: "2026-07-17" }));
    renderFlow("/member", { api: { dashboard } }); expect(await screen.findByText("Alice")).toBeInTheDocument(); expect(screen.getByText(/1 笔订单/)).toBeInTheDocument();
  });

  it("shows gift-card transactions and recharges with a UUID", async () => {
    const giftCard = vi.fn(async () => ({ balance: 5000, persistent: true, transactions: [{ id: "t1", type: "RECHARGE" as const, amount: 5000, reference: "r1", orderNumber: null, createdAt: "2026-07-17T00:00:00+08:00" }] }));
    const recharge = vi.fn(async () => ({ balance: 15000, idempotent: false })); const user = userEvent.setup(); renderFlow("/gift-card", { api: { giftCard, recharge } });
    expect(await screen.findByText("RECHARGE")).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "¥100.00" }));
    await waitFor(() => expect(recharge).toHaveBeenCalledWith(expect.objectContaining({ amount: 10000, token: expect.stringMatching(/^[0-9a-f-]{36}$/) })));
  });

  it("renders the API-owned order detail without persisting it", async () => {
    const order = vi.fn(async () => ({ id: "o1", orderNumber: "CB1", kind: "MENU" as const, status: "READY", totalAmount: 3200, pickupName: "Alice", pickupPhone: "", pickupAt: "2026-07-17T10:00:00+08:00", note: null, paidAt: "2026-07-17T09:00:00+08:00", createdAt: "2026-07-17T09:00:00+08:00", items: [{ id: "i1", productId: "latte", productName: "Latte", productImage: "", category: "Coffee", unitPrice: 3200, quantity: 1, options: [], subtotal: 3200 }] }));
    renderFlow("/orders/o1", { api: { order } }); expect(await screen.findByRole("heading", { name: "READY" })).toBeInTheDocument(); expect(screen.getByText("Latte ×1")).toBeInTheDocument();
    expect(window.localStorage.getItem("orders")).toBeNull();
  });

  it("lets guests read a message and only syncs read state for an online member", async () => {
    const detail = { id: "m1", title: "Hello", summary: "Summary", content: "Body", coverUrl: null, publishedAt: "2026-07-17T00:00:00+08:00", createdAt: "2026-07-17T00:00:00+08:00", read: false };
    const guest = renderFlow("/messages/m1", { auth: { status: "anonymous", user: null }, api: { announcement: vi.fn(async () => detail) } });
    expect(await screen.findByRole("heading", { name: "Hello" })).toBeInTheDocument(); expect(guest.services.customerApi.markAnnouncementRead).not.toHaveBeenCalled();
  });

  it("syncs an unread message once for an authenticated online member", async () => {
    const detail = { id: "m1", title: "Hello", summary: "Summary", content: "Body", coverUrl: null, publishedAt: "2026-07-17T00:00:00+08:00", createdAt: "2026-07-17T00:00:00+08:00", read: false };
    const member = renderFlow("/messages/m1", { api: { announcement: vi.fn(async () => detail), markAnnouncementRead: vi.fn(async () => ({ read: true })) } });
    await screen.findByRole("heading", { name: "Hello" });
    await waitFor(() => expect(member.services.customerApi.markAnnouncementRead).toHaveBeenCalledTimes(1));
  });

  it("requires password plus confirmation before deleting and clears sensitive cache", async () => {
    const user = userEvent.setup(); const { controller, queryClient } = renderFlow("/privacy-account"); queryClient.setQueryData(["orders"], [{ id: "o1" }]);
    await user.type(screen.getByLabelText("当前密码"), "password1"); await user.click(screen.getByLabelText(/account and data|账户和数据|账户和数据/));
    await user.click(screen.getByRole("button", { name: "永久删除账户" }));
    await waitFor(() => expect(controller.deleteAccount).toHaveBeenCalledWith("password1")); expect(queryClient.getQueryData(["orders"])).toBeUndefined();
  });
});
