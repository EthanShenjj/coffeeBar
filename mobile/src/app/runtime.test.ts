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

  it("does not let a stale request 401 erase a newer login", async () => {
    let storedToken: string | null = "old-token";
    const tokenStore: SessionTokenStore = {
      get: vi.fn(async () => storedToken),
      set: vi.fn(async (value) => { storedToken = value; }),
      remove: vi.fn(async () => { storedToken = null; }),
    };
    let finishOldRequest!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { finishOldRequest = resolve; });
    const fetcher = vi.fn(async (input: string) => {
      if (input.endsWith("/api/auth/get-session")) return Response.json({ user: { id: "u1", name: "Old", email: "old@example.com" } });
      if (input.endsWith("/api/auth/sign-in/email")) return new Response(JSON.stringify({ user: { id: "u2", name: "New", email: "new@example.com" } }), { headers: { "Content-Type": "application/json", "set-auth-token": "new-token" } });
      return oldResponse;
    });
    const navigate = vi.fn();
    const runtime = createMobileRuntime({ apiBaseUrl: "https://api.example.com", tokenStore, fetcher, navigate, getCurrentPath: () => "/orders" });
    await runtime.auth.restore();
    const staleRequest = runtime.api.get("/api/v1/me/orders");
    await runtime.auth.signIn({ email: "new@example.com", password: "password1" });
    finishOldRequest(Response.json({ error: { code: "UNAUTHORIZED", message: "old expired" } }, { status: 401 }));
    await expect(staleRequest).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(storedToken).toBe("new-token");
    expect(runtime.auth.getSnapshot()).toEqual({ status: "authenticated", user: { id: "u2", name: "New", email: "new@example.com" } });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("serializes a new login behind in-flight credential cleanup without stale navigation", async () => {
    let storedToken: string | null = "old-token";
    let releaseRemoval!: () => void;
    let removalStarted!: () => void;
    const removalStartedPromise = new Promise<void>((resolve) => { removalStarted = resolve; });
    const removalGate = new Promise<void>((resolve) => { releaseRemoval = resolve; });
    const tokenStore: SessionTokenStore = {
      get: vi.fn(async () => storedToken),
      set: vi.fn(async (value) => { storedToken = value; }),
      remove: vi.fn(async () => { removalStarted(); await removalGate; storedToken = null; }),
    };
    const fetcher = vi.fn(async (input: string) => {
      if (input.endsWith("/api/auth/get-session")) return Response.json({ user: { id: "u1", name: "Old", email: "old@example.com" } });
      if (input.endsWith("/api/auth/sign-in/email")) return new Response(JSON.stringify({ user: { id: "u2", name: "New", email: "new@example.com" } }), { headers: { "Content-Type": "application/json", "set-auth-token": "new-token" } });
      return Response.json({ error: { code: "UNAUTHORIZED", message: "expired" } }, { status: 401 });
    });
    const navigate = vi.fn();
    const queryClient = new QueryClient();
    queryClient.setQueryData(["orders"], [{ id: "old-private-data" }]);
    const runtime = createMobileRuntime({ apiBaseUrl: "https://api.example.com", tokenStore, fetcher, navigate, queryClient, deviceId: "phone" });
    await runtime.auth.restore();
    const rejectedRequest = runtime.api.get("/api/v1/me/orders");
    await removalStartedPromise;
    const newLogin = runtime.auth.signIn({ email: "new@example.com", password: "password1" });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    releaseRemoval();
    await Promise.all([newLogin, expect(rejectedRequest).rejects.toMatchObject({ code: "UNAUTHORIZED" })]);
    expect(storedToken).toBe("new-token");
    expect(runtime.auth.getSnapshot().status).toBe("authenticated");
    expect(queryClient.getQueryData(["orders"])).toEqual([{ id: "old-private-data" }]);
    expect(navigate).not.toHaveBeenCalled();
  });
});
