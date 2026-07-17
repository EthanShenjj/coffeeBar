import type { SessionTokenStore } from "./session-token-store";

export type SessionUser = { id: string; name: string; email: string };
export type AuthSnapshot = {
  status: "restoring" | "authenticated" | "anonymous";
  user: SessionUser | null;
};

type AuthControllerOptions = {
  tokenStore: SessionTokenStore;
  apiBaseUrl: string;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  deviceId?: string;
};

function url(base: string, path: string) {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

function parseUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.email !== "string" || typeof record.name !== "string") return null;
  return { id: record.id, email: record.email, name: record.name };
}

export function createAuthController(options: AuthControllerOptions) {
  const fetcher = options.fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init));
  let token: string | null = null;
  let snapshot: AuthSnapshot = { status: "restoring", user: null };
  let sessionEpoch = 0;
  let invalidationTask: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: AuthSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const authHeaders = () => {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  };

  async function restore() {
    const restoreEpoch = sessionEpoch;
    let restoredToken: string | null;
    try {
      restoredToken = await options.tokenStore.get();
    } catch {
      restoredToken = null;
    }
    if (restoreEpoch !== sessionEpoch) return;
    token = restoredToken;
    if (!restoredToken) {
      if (restoreEpoch === sessionEpoch) publish({ status: "anonymous", user: null });
      return;
    }
    try {
      const response = await fetcher(url(options.apiBaseUrl, "/api/auth/get-session"), { headers: authHeaders() });
      const body = await response.json() as { user?: unknown } | null;
      const user = response.ok ? parseUser(body?.user) : null;
      if (restoreEpoch !== sessionEpoch) return;
      if (!user) {
        try {
          await options.tokenStore.remove();
        } finally {
          token = null;
          publish({ status: "anonymous", user: null });
        }
        return;
      }
      publish({ status: "authenticated", user });
    } catch {
      // A transport failure does not prove that the credential is invalid.
      if (restoreEpoch === sessionEpoch) publish({ status: "anonymous", user: null });
    }
  }

  async function invalidateSession() {
    invalidationTask ??= (async () => {
      sessionEpoch += 1;
      token = null;
      publish({ status: "anonymous", user: null });
      try {
        await options.tokenStore.remove();
      } catch {
        // In-memory authentication must still be invalidated if Keychain is unavailable.
      }
    })().finally(() => { invalidationTask = null; });
    await invalidationTask;
  }

  async function submit(path: string, input: Record<string, unknown>) {
    const response = await fetcher(url(options.apiBaseUrl, path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => null) as { user?: unknown; message?: string } | null;
    if (!response.ok) throw new Error(body?.message ?? "认证失败，请稍后重试");
    const nextToken = response.headers.get("set-auth-token");
    const user = parseUser(body?.user);
    if (!nextToken || !user) throw new Error("登录响应无效");
    await options.tokenStore.set(nextToken);
    token = nextToken;
    publish({ status: "authenticated", user });
    return user;
  }

  async function signOut() {
    token = token ?? await options.tokenStore.get();
    try {
      await fetcher(url(options.apiBaseUrl, "/api/auth/sign-out"), { method: "POST", headers: authHeaders() });
    } catch {
      // Local logout must continue.
    }
    if (options.deviceId) {
      try {
        await fetcher(url(options.apiBaseUrl, `/api/v1/me/push-tokens/${encodeURIComponent(options.deviceId)}`), {
          method: "DELETE", headers: authHeaders(),
        });
      } catch {
        // Token cleanup is best effort while offline.
      }
    }
    await invalidateSession();
  }

  return {
    restore,
    signIn: (input: { email: string; password: string }) => submit("/api/auth/sign-in/email", input),
    signUp: (input: { name: string; email: string; password: string }) => submit("/api/auth/sign-up/email", input),
    signOut,
    invalidateSession,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
