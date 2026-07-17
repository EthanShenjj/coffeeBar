import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabase: vi.fn(() => true),
  requireUser: vi.fn(),
  getSession: vi.fn(),
  getProducts: vi.fn(),
  getAnnouncements: vi.fn(),
  getAnnouncement: vi.fn(),
  markRead: vi.fn(),
  getDashboard: vi.fn(),
  getOrders: vi.fn(),
  getOrder: vi.fn(),
  getGiftCard: vi.fn(),
  checkout: vi.fn(),
  recharge: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ hasDatabase: mocks.hasDatabase }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  requireUserFromHeaders: mocks.requireUser,
  getSessionFromHeaders: mocks.getSession,
}));
vi.mock("@/lib/catalog", () => ({ getProducts: mocks.getProducts }));
vi.mock("@/server/services/announcements", () => ({
  getAnnouncementsForUser: mocks.getAnnouncements,
  getAnnouncementForUser: mocks.getAnnouncement,
  markAnnouncementReadForUser: mocks.markRead,
}));
vi.mock("@/server/services/profiles", () => ({ getProfileDashboardForUser: mocks.getDashboard }));
vi.mock("@/server/services/orders", () => ({ getOrdersForUser: mocks.getOrders, getOrderForUser: mocks.getOrder }));
vi.mock("@/server/services/gift-cards", () => ({ getGiftCardSummaryForUser: mocks.getGiftCard }));
vi.mock("@/server/services/checkout", () => ({ checkoutForUser: mocks.checkout }));
vi.mock("@/server/services/gift-card-recharge", () => ({ rechargeGiftCardForUser: mocks.recharge }));

import { GET as getAppConfig } from "@/app/api/v1/app-config/route";
import { GET as getCatalog, OPTIONS as catalogOptions } from "@/app/api/v1/catalog/route";
import { GET as getAnnouncements } from "@/app/api/v1/announcements/route";
import { GET as getAnnouncement } from "@/app/api/v1/announcements/[id]/route";
import { GET as getDashboard } from "@/app/api/v1/me/dashboard/route";
import { GET as getOrders } from "@/app/api/v1/me/orders/route";
import { GET as getOrder } from "@/app/api/v1/me/orders/[id]/route";
import { GET as getGiftCard } from "@/app/api/v1/me/gift-card/route";
import { POST as markRead } from "@/app/api/v1/me/messages/[id]/read/route";
import { POST as checkout } from "@/app/api/v1/checkout/route";
import { POST as recharge } from "@/app/api/v1/gift-card/recharges/route";

const originalEnv = { ...process.env };
const user = { id: "user-1", name: "Lin", email: "lin@example.test", role: "CUSTOMER" };
const product = {
  id: "latte", slug: "latte", name: "Latte", subtitle: "", description: "", channel: "MENU",
  category: "Coffee", price: 1500, imageUrl: "https://example.test/latte.jpg", stock: null,
  isAvailable: true, optionGroups: [],
};

function request(path: string, init?: RequestInit) {
  return new Request(`https://api.example.test${path}`, init);
}

function bearerRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", "Bearer mobile-session-token");
  return request(path, { ...init, headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasDatabase.mockReturnValue(true);
  mocks.requireUser.mockResolvedValue(user);
  mocks.getSession.mockResolvedValue(null);
  process.env.NEXT_PUBLIC_APP_URL = "https://coffee.example";
  process.env.BETTER_AUTH_URL = "https://coffee.example";
  delete process.env.MOBILE_ALLOWED_ORIGIN;
  delete process.env.IOS_MINIMUM_VERSION;
  delete process.env.IOS_MAINTENANCE_MODE;
  delete process.env.MINIMUM_IOS_VERSION;
  delete process.env.APP_MAINTENANCE_MODE;
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

describe("/api/v1 customer routes", () => {
  it("returns app config defaults derived from the public app URL", async () => {
    const response = await getAppConfig(request("/api/v1/app-config"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: {
      minimumIosVersion: "1.0.0", maintenance: false,
      privacyUrl: "https://coffee.example/privacy", supportUrl: "https://coffee.example/support", apiVersion: "v1",
    } });
  });

  it("reads the planned iOS app-config environment names", async () => {
    process.env.IOS_MINIMUM_VERSION = "2.3.4";
    process.env.IOS_MAINTENANCE_MODE = "true";
    const response = await getAppConfig(request("/api/v1/app-config"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: {
      minimumIosVersion: "2.3.4",
      maintenance: true,
    } });
  });

  it("ignores legacy iOS app-config environment names", async () => {
    process.env.MINIMUM_IOS_VERSION = "9.9.9";
    process.env.APP_MAINTENANCE_MODE = "true";
    const response = await getAppConfig(request("/api/v1/app-config"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: {
      minimumIosVersion: "1.0.0",
      maintenance: false,
    } });
  });

  it("fails app-config closed in production without a database", async () => {
    mocks.hasDatabase.mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "production");
    const response = await getAppConfig(request("/api/v1/app-config"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
  });

  it("returns a sanitized server error for invalid app-config output", async () => {
    process.env.IOS_MINIMUM_VERSION = "not-a-version postgres-password=secret";
    const response = await getAppConfig(request("/api/v1/app-config"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR", message: "服务器暂时无法处理请求" } });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("applies CORS to actual routes and preflight", async () => {
    mocks.getProducts.mockResolvedValue([product]);
    const allowed = await getCatalog(request("/api/v1/catalog?channel=MENU", { headers: { origin: "capacitor://localhost" } }));
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
    const noOrigin = await getCatalog(request("/api/v1/catalog?channel=MENU"));
    expect(noOrigin.status).toBe(200);
    const denied = await getCatalog(request("/api/v1/catalog?channel=MENU", { headers: { origin: "https://evil.test" } }));
    expect(denied.status).toBe(403);
    expect(catalogOptions(request("/api/v1/catalog", { method: "OPTIONS", headers: { origin: "capacitor://localhost" } })).status).toBe(204);
  });

  it("validates catalog channel and permits a development demo catalog", async () => {
    const invalid = await getCatalog(request("/api/v1/catalog?channel=ADMIN"));
    expect(invalid.status).toBe(400);
    mocks.hasDatabase.mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "development");
    mocks.getProducts.mockResolvedValue([product]);
    const demo = await getCatalog(request("/api/v1/catalog?channel=MENU"));
    expect(demo.status).toBe(200);
    await expect(demo.json()).resolves.toEqual({ data: [product] });
  });

  it("fails public no-database requests closed outside development", async () => {
    mocks.hasDatabase.mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "test");
    const response = await getCatalog(request("/api/v1/catalog?channel=MENU"));
    expect(response.status).toBe(503);
    expect(mocks.getProducts).not.toHaveBeenCalled();
  });

  it("fails closed instead of returning demo state in production", async () => {
    mocks.hasDatabase.mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "production");
    const response = await getCatalog(request("/api/v1/catalog?channel=MENU"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
    expect(mocks.getProducts).not.toHaveBeenCalled();
  });

  it("serves public announcements with optional session read state", async () => {
    const summary = { id: "a1", title: "News", summary: "Hello", date: "2026-07-17", read: false };
    const detail = { ...summary, content: "Body", coverUrl: null, publishedAt: "2026-07-17T08:00:00.000Z", createdAt: "2026-07-17T07:00:00.000Z" };
    mocks.getAnnouncements.mockResolvedValue([summary]);
    mocks.getAnnouncement.mockResolvedValue(detail);
    expect((await getAnnouncements(request("/api/v1/announcements"))).status).toBe(200);
    const response = await getAnnouncement(request("/api/v1/announcements/a1"), { params: Promise.resolve({ id: "a1" }) });
    expect(response.status).toBe(200);
    expect(mocks.getAnnouncement).toHaveBeenCalledWith(null, "a1");
  });

  it("rejects cookie-only no-Origin requests before calling Better Auth", async () => {
    const response = await getDashboard(request("/api/v1/me/dashboard", {
      headers: { cookie: "better-auth.session_token=valid-web-cookie" },
    }));
    expect(response.status).toBe(401);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.getDashboard).not.toHaveBeenCalled();
  });

  it("rejects malformed authorization schemes before calling Better Auth", async () => {
    const response = await getDashboard(request("/api/v1/me/dashboard", {
      headers: { authorization: "Basic abc123" },
    }));
    expect(response.status).toBe(401);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.getDashboard).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes a valid Bearer request to Better Auth", async () => {
    mocks.getDashboard.mockResolvedValue({ user: { name: "Lin", email: "lin@example.test", role: "CUSTOMER" } });
    const response = await getDashboard(bearerRequest("/api/v1/me/dashboard", {
      headers: { cookie: "better-auth.session_token=valid-web-cookie" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    const authHeaders = mocks.requireUser.mock.calls[0]?.[0] as Headers;
    expect(authHeaders.get("authorization")).toBe("Bearer mobile-session-token");
    expect(authHeaders.get("cookie")).toBeNull();
  });

  it("returns 503 for authenticated endpoints without a database", async () => {
    mocks.hasDatabase.mockReturnValue(false);
    const response = await getOrders(request("/api/v1/me/orders"));
    expect(response.status).toBe(503);
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it("returns 404 when an order is not owned by the authenticated user", async () => {
    mocks.getOrder.mockResolvedValue(null);
    const response = await getOrder(bearerRequest("/api/v1/me/orders/order-2"), { params: Promise.resolve({ id: "order-2" }) });
    expect(response.status).toBe(404);
    expect(mocks.getOrder).toHaveBeenCalledWith("user-1", "order-2");
  });

  it("delegates authenticated read and read-receipt routes", async () => {
    mocks.getDashboard.mockResolvedValue({ user: { name: "Lin", email: "lin@example.test", role: "CUSTOMER" } });
    mocks.getGiftCard.mockResolvedValue({ balance: 0, transactions: [], persistent: true });
    expect((await getDashboard(bearerRequest("/api/v1/me/dashboard"))).status).toBe(200);
    expect((await getGiftCard(bearerRequest("/api/v1/me/gift-card"))).status).toBe(200);
    const readResponse = await markRead(bearerRequest("/api/v1/me/messages/a1/read", { method: "POST" }), { params: Promise.resolve({ id: "a1" }) });
    await expect(readResponse.json()).resolves.toEqual({ data: { read: true } });
    expect(mocks.markRead).toHaveBeenCalledWith("user-1", "a1");
  });

  it("rejects malformed and schema-invalid checkout bodies", async () => {
    const malformed = await checkout(bearerRequest("/api/v1/checkout", { method: "POST", body: "{" }));
    expect(malformed.status).toBe(400);
    const invalid = await checkout(bearerRequest("/api/v1/checkout", {
      method: "POST", body: JSON.stringify({ kind: "MENU", items: [] }),
    }));
    expect(invalid.status).toBe(400);
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("unwraps checkout service success and maps conflicts", async () => {
    const body = {
      token: "00000000-0000-4000-8000-000000000001", kind: "MENU", pickupName: "Lin Mo",
      pickupPhone: "13800138000", pickupAt: new Date(Date.now() + 60_000).toISOString(),
      items: [{ productId: "latte", quantity: 1, optionIds: [] }],
    };
    const result = { ok: true, orderId: "o1", orderNumber: "CB1", totalAmount: 1500, giftCardAmount: 0, externalAmount: 1500, demo: false };
    mocks.checkout.mockResolvedValueOnce({ result, created: true });
    const success = await checkout(bearerRequest("/api/v1/checkout", { method: "POST", body: JSON.stringify(body) }));
    await expect(success.json()).resolves.toEqual({ data: result });
    mocks.checkout.mockResolvedValueOnce({ result: { ok: false, message: "Latte库存不足" }, created: false });
    const conflict = await checkout(bearerRequest("/api/v1/checkout", { method: "POST", body: JSON.stringify(body) }));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ error: { code: "CONFLICT", message: "商品库存不足，请刷新后重试" } });
  });

  it("does not leak unexpected checkout errors", async () => {
    mocks.checkout.mockRejectedValueOnce(new Error("postgres password=secret"));
    const response = await checkout(bearerRequest("/api/v1/checkout", {
      method: "POST",
      body: JSON.stringify({
        token: "00000000-0000-4000-8000-000000000001", kind: "MENU", pickupName: "Lin Mo",
        pickupPhone: "", pickupAt: new Date(Date.now() + 60_000).toISOString(),
        items: [{ productId: "latte", quantity: 1, optionIds: [] }],
      }),
    }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });

  it("returns the recharge idempotency result", async () => {
    mocks.recharge.mockResolvedValue({ ok: true, balance: 20_000, idempotent: true });
    const response = await recharge(bearerRequest("/api/v1/gift-card/recharges", {
      method: "POST",
      body: JSON.stringify({ token: "00000000-0000-4000-8000-000000000001", amount: 10_000 }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { balance: 20_000, idempotent: true } });
  });
});
