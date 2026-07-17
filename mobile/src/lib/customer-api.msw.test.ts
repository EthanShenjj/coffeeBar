import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createAuthController } from "../auth/auth-controller";
import { createNetworkStore } from "../state/network-store";
import { createApiClient } from "./api-client";
import { createCustomerApi } from "./customer-api";

const server = setupServer(http.post("https://api.example.com/api/v1/checkout", async ({ request }) => {
  expect(request.headers.get("authorization")).toBe("Bearer secure-token");
  const body = await request.json() as { token: string };
  return HttpResponse.json({ data: { ok: true, orderId: "o1", orderNumber: "CB1", totalAmount: 3200, giftCardAmount: 0, externalAmount: 3200, demo: true, echoedToken: body.token } });
}));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("uses the real API envelope and bearer transport with MSW", async () => {
  const tokenStore = { get: vi.fn(async () => "secure-token"), set: vi.fn(), remove: vi.fn() };
  const auth = createAuthController({ apiBaseUrl: "https://api.example.com", tokenStore });
  const api = createApiClient({ baseUrl: "https://api.example.com", tokenStore, invalidateSession: auth.invalidateSession, clearSensitiveSessionQueries: vi.fn() });
  const customer = createCustomerApi(api, createNetworkStore({ initialOnline: true }));
  await expect(customer.checkout({ token: "550e8400-e29b-41d4-a716-446655440000", kind: "MENU", pickupName: "Alice", pickupPhone: "", pickupAt: new Date(Date.now() + 60_000).toISOString(), useGiftCard: false, items: [{ productId: "p1", quantity: 1, optionIds: [] }] })).resolves.toMatchObject({ ok: true, orderId: "o1" });
});
