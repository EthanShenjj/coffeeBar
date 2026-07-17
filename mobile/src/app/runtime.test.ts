import type { ProductView } from "@coffeebar/contracts";
import { QueryClient } from "@tanstack/react-query";
import { createMobileRuntime } from "./runtime";
import { createCartStore } from "../state/cart-store";
import type { SessionTokenStore } from "../auth/session-token-store";

const coffee: ProductView = {
  id: "coffee-1", slug: "latte", name: "Latte", subtitle: "", description: "", channel: "MENU",
  category: "Coffee", price: 3200, imageUrl: "", stock: null, isAvailable: true, optionGroups: [],
};

describe("runtime 401 session invalidation", () => {
  it("atomically invalidates auth and sensitive cache once without clearing carts", async () => {
    let storedToken: string | null = "valid-token";
    const tokenStore: SessionTokenStore = {
      get: vi.fn(async () => storedToken),
      set: vi.fn(async (value) => { storedToken = value; }),
      remove: vi.fn(async () => { storedToken = null; }),
    };
    const fetcher = vi.fn(async (input: string) => {
      if (input.endsWith("/api/auth/get-session")) {
        return Response.json({ user: { id: "u1", name: "A", email: "a@example.com" }, session: { id: "s1" } });
      }
      return Response.json({ error: { code: "UNAUTHORIZED", message: "expired" } }, { status: 401 });
    });
    const navigate = vi.fn();
    const queryClient = new QueryClient();
    queryClient.setQueryData(["session"], { userId: "u1" });
    queryClient.setQueryData(["orders"], [{ id: "private-order" }], { updatedAt: Date.now() });
    const cart = createCartStore("MENU", { storage: window.localStorage });
    cart.getState().addItem(coffee, []);
    const runtime = createMobileRuntime({
      apiBaseUrl: "https://api.example.com", tokenStore, fetcher, navigate,
      getCurrentPath: () => "/orders/o1", queryClient,
    });
    await runtime.auth.restore();
    expect(runtime.auth.getSnapshot().status).toBe("authenticated");

    const results = await Promise.allSettled([
      runtime.api.get("/api/v1/me/orders/o1"),
      runtime.api.get("/api/v1/me/dashboard"),
    ]);

    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(runtime.auth.getSnapshot()).toEqual({ status: "anonymous", user: null });
    expect(storedToken).toBeNull();
    expect(tokenStore.remove).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(["session"])).toBeUndefined();
    expect(queryClient.getQueryData(["orders"])).toBeUndefined();
    expect(window.sessionStorage.getItem("coffeebar.intended-route")).toBe("/orders/o1");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
    expect(cart.getState().items).toHaveLength(1);
  });
});
