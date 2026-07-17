import { createApiClient } from "../lib/api-client";
import { createAuthController } from "./auth-controller";
import { createBrowserSessionTokenStore, createNativeSessionTokenStore } from "./session-token-store";

describe("mobile bearer session", () => {
  it("restores the token before requesting the session and sends Authorization", async () => {
    window.sessionStorage.setItem("coffeebar.session-token", "restored");
    const events: string[] = [];
    const store = createBrowserSessionTokenStore({ onRead: () => events.push("restore") });
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      events.push("session");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer restored");
      return Response.json({ user: { id: "u1", email: "a@example.com", name: "A" }, session: { id: "s1" } });
    });
    const auth = createAuthController({ tokenStore: store, fetcher, apiBaseUrl: "https://api.example.com" });
    await auth.restore();
    expect(events).toEqual(["restore", "session"]);
    expect(auth.getSnapshot().status).toBe("authenticated");
  });

  it.each([500, 503])("keeps a valid stored token on a retryable %s session response", async (status) => {
    const store = createBrowserSessionTokenStore();
    await store.set("still-valid");
    const auth = createAuthController({
      tokenStore: store,
      apiBaseUrl: "https://api.example.com",
      fetcher: vi.fn(async () => Response.json({ message: "temporary" }, { status })),
    });
    await auth.restore();
    expect(await store.get()).toBe("still-valid");
    expect(auth.getSnapshot()).toEqual({ status: "retryable", user: null });
  });

  it("captures set-auth-token after email sign in", async () => {
    const store = createBrowserSessionTokenStore();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user: { id: "u1", email: "a@example.com", name: "A" } }), {
      status: 200, headers: { "Content-Type": "application/json", "set-auth-token": "signed-token" },
    }));
    const auth = createAuthController({ tokenStore: store, fetcher, apiBaseUrl: "https://api.example.com" });
    await auth.signIn({ email: "a@example.com", password: "password1" });
    expect(await store.get()).toBe("signed-token");
    expect(fetcher).toHaveBeenCalledWith("https://api.example.com/api/auth/sign-in/email", expect.objectContaining({ method: "POST" }));
  });

  it("clears token and records intended route on an API 401", async () => {
    const store = createBrowserSessionTokenStore();
    await store.set("expired");
    const navigate = vi.fn();
    const clearSessionQuery = vi.fn();
    const invalidateSession = vi.fn(async () => { await store.remove(); return "invalidated" as const; });
    const client = createApiClient({
      baseUrl: "https://api.example.com", tokenStore: store, navigate,
      fetcher: vi.fn(async () => Response.json({ error: { code: "UNAUTHORIZED", message: "expired" } }, { status: 401 })),
      getCurrentPath: () => "/orders/o1",
      clearSensitiveSessionQueries: clearSessionQuery,
      invalidateSession,
    });
    await expect(client.get("/api/v1/me/orders/o1")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await store.get()).toBeNull();
    expect(window.sessionStorage.getItem("coffeebar.intended-route")).toBe("/orders/o1");
    expect(clearSessionQuery).toHaveBeenCalledOnce();
    expect(invalidateSession).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("uses only the native secure-store bridge on native platforms", async () => {
    const plugin = {
      getToken: vi.fn(async () => ({ value: "keychain-token" })),
      setToken: vi.fn(async () => undefined),
      removeToken: vi.fn(async () => undefined),
    };
    const store = createNativeSessionTokenStore(plugin);
    expect(await store.get()).toBe("keychain-token");
    await store.set("next-token");
    await store.remove();
    expect(plugin.setToken).toHaveBeenCalledWith({ value: "next-token" });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("unregisters push while bearer auth is valid, then revokes and clears locally", async () => {
    const events: string[] = [];
    const store = {
      get: vi.fn(async () => "token"), set: vi.fn(), remove: vi.fn(async () => { events.push("clear"); }),
    };
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token");
      events.push(url.includes("push-tokens") ? "push" : "revoke");
      return Response.json({ data: { removed: true } });
    });
    const auth = createAuthController({ tokenStore: store, fetcher, apiBaseUrl: "https://api.example.com", deviceId: "phone-1" });
    await auth.signOut();
    expect(events).toEqual(["push", "revoke", "clear"]);
  });

  it("bounds push cleanup retries and always clears locally when offline", async () => {
    const events: string[] = [];
    const store = {
      get: vi.fn(async () => "token"), set: vi.fn(),
      remove: vi.fn(async () => { events.push("clear"); }),
    };
    const fetcher = vi.fn(async (url: string) => {
      events.push(url.includes("sign-out") ? "revoke" : "push");
      throw new Error("offline");
    });
    const auth = createAuthController({ tokenStore: store, fetcher, apiBaseUrl: "https://api.example.com", deviceId: "phone-1" });
    await auth.signOut();
    expect(events).toEqual(["push", "push", "revoke", "clear"]);
    expect(auth.getSnapshot().status).toBe("anonymous");
  });

  it("still completes local logout when secure-store reads fail", async () => {
    const store = {
      get: vi.fn(async () => { throw new Error("Keychain unavailable"); }),
      set: vi.fn(),
      remove: vi.fn(async () => undefined),
    };
    const auth = createAuthController({ tokenStore: store, fetcher: vi.fn(async () => { throw new Error("offline"); }), apiBaseUrl: "https://api.example.com" });
    await expect(auth.signOut()).resolves.toBeUndefined();
    expect(store.remove).toHaveBeenCalledOnce();
    expect(auth.getSnapshot().status).toBe("anonymous");
  });
});
