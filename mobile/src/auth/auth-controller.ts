import type { SessionTokenStore } from "./session-token-store";

export type SessionUser = { id: string; name: string; email: string };
export type AuthSnapshot = {
  status: "restoring" | "authenticated" | "anonymous" | "retryable";
  user: SessionUser | null;
};
export type SessionInvalidationResult = "stale" | "invalidated" | "superseded";

type AuthControllerOptions = {
  tokenStore: SessionTokenStore;
  apiBaseUrl: string;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  deviceId?: string;
  requestTimeoutMs?: number;
  timer?: {
    setTimeout(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
    clearTimeout(handle: ReturnType<typeof setTimeout>): void;
  };
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
  const timer = options.timer ?? { setTimeout, clearTimeout };
  const requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
  let token: string | null = null;
  let snapshot: AuthSnapshot = { status: "restoring", user: null };
  let sessionEpoch = 0;
  let credentialWrite: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: AuthSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const authHeaders = (value: string | null = token) => {
    const headers = new Headers();
    if (value) headers.set("Authorization", `Bearer ${value}`);
    return headers;
  };
  const enqueueCredentialWrite = <T>(operation: () => Promise<T>) => {
    const result = credentialWrite.then(operation, operation);
    credentialWrite = result.then(() => undefined, () => undefined);
    return result;
  };
  const isRestoreCurrent = (epoch: number, restoredToken: string) => epoch === sessionEpoch && token === restoredToken;

  async function boundedFetch(input: string, init: RequestInit) {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Response>((_, reject) => {
      timeoutHandle = timer.setTimeout(() => {
        controller.abort();
        reject(new DOMException("Request timed out", "AbortError"));
      }, requestTimeoutMs);
    });
    try {
      return await Promise.race([fetcher(input, { ...init, signal: controller.signal }), timeout]);
    } finally {
      if (timeoutHandle !== undefined) timer.clearTimeout(timeoutHandle);
    }
  }

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
      if (!isRestoreCurrent(restoreEpoch, restoredToken)) return;
      if (response.status === 401) {
        await invalidateSession(restoredToken);
        return;
      }
      if (!response.ok) {
        if (isRestoreCurrent(restoreEpoch, restoredToken)) publish({ status: "retryable", user: null });
        return;
      }
      let body: { user?: unknown } | null;
      try {
        body = await response.json() as { user?: unknown } | null;
      } catch {
        if (isRestoreCurrent(restoreEpoch, restoredToken)) publish({ status: "retryable", user: null });
        return;
      }
      if (!isRestoreCurrent(restoreEpoch, restoredToken)) return;
      const user = parseUser(body?.user);
      if (!user) {
        await invalidateSession(restoredToken);
        return;
      }
      if (isRestoreCurrent(restoreEpoch, restoredToken)) publish({ status: "authenticated", user });
    } catch {
      // A transport failure does not prove that the credential is invalid.
      if (restoreEpoch === sessionEpoch) publish({ status: "retryable", user: null });
    }
  }

  async function invalidateSession(expectedToken: string | null) {
    if (token !== expectedToken) return "stale" as const;
    const invalidationEpoch = ++sessionEpoch;
    token = null;
    publish({ status: "anonymous", user: null });
    await enqueueCredentialWrite(async () => {
      try {
        await options.tokenStore.remove();
      } catch {
        // In-memory authentication must still be invalidated if Keychain is unavailable.
      }
    });
    return sessionEpoch === invalidationEpoch && token === null ? "invalidated" as const : "superseded" as const;
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
    const submitEpoch = ++sessionEpoch;
    token = nextToken;
    try {
      await enqueueCredentialWrite(() => options.tokenStore.set(nextToken));
    } catch {
      if (submitEpoch === sessionEpoch) {
        token = null;
        publish({ status: "anonymous", user: null });
      }
      throw new Error("无法安全保存登录状态");
    }
    if (submitEpoch !== sessionEpoch || token !== nextToken) throw new Error("登录状态已变更，请重试");
    publish({ status: "authenticated", user });
    return user;
  }

  async function signOut() {
    if (!token) {
      try { token = await options.tokenStore.get(); } catch { token = null; }
    }
    const logoutToken = token;
    const logoutHeaders = authHeaders(logoutToken);
    if (options.deviceId) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await boundedFetch(url(options.apiBaseUrl, `/api/v1/me/push-tokens/${encodeURIComponent(options.deviceId)}`), {
            method: "DELETE", headers: logoutHeaders,
          });
          if (response.ok || response.status < 500) break;
        } catch {
          // Retry once before continuing local logout.
        }
      }
    }
    try {
      await boundedFetch(url(options.apiBaseUrl, "/api/auth/sign-out"), { method: "POST", headers: logoutHeaders });
    } catch {
      // Local logout must continue.
    }
    await invalidateSession(logoutToken);
  }

  async function deleteAccount(password: string) {
    if (!token) {
      try { token = await options.tokenStore.get(); } catch { token = null; }
    }
    const deletionToken = token;
    if (!deletionToken) throw new Error("请先登录后再删除账户");
    let response: Response;
    try {
      response = await boundedFetch(url(options.apiBaseUrl, "/api/auth/delete-user"), {
        method: "POST",
        headers: { ...Object.fromEntries(authHeaders(deletionToken)), "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      throw new Error("暂时无法删除账户，请检查网络后重试");
    }
    const body = await response.json().catch(() => null) as { success?: boolean } | null;
    if (!response.ok || body?.success !== true) {
      if (response.status === 400 || response.status === 401) throw new Error("当前密码不正确，账户未删除");
      throw new Error("暂时无法删除账户，请稍后重试");
    }
    await invalidateSession(deletionToken);
  }

  return {
    restore,
    signIn: (input: { email: string; password: string }) => submit("/api/auth/sign-in/email", input),
    signUp: (input: { name: string; email: string; password: string }) => submit("/api/auth/sign-up/email", input),
    signOut,
    deleteAccount,
    invalidateSession,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
