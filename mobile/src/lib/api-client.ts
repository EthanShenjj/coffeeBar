import { apiFailureSchema, apiSuccessSchema, type ApiErrorCode } from "@coffeebar/contracts";
import { z } from "zod";
import type { SessionTokenStore } from "../auth/session-token-store";
import { saveIntendedRoute } from "../auth/intended-route";

export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ClientOptions = {
  baseUrl: string;
  tokenStore: SessionTokenStore;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  navigate?: (path: string, options?: { replace?: boolean }) => void;
  getCurrentPath?: () => string;
  clearSessionQuery?: () => Promise<void> | void;
};

type RequestOptions<T> = RequestInit & { schema?: z.ZodType<T>; authenticated?: boolean };

function joinUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

export function createApiClient(options: ClientOptions) {
  const fetcher = options.fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init));
  let unauthorizedTask: Promise<void> | null = null;

  async function handleUnauthorized() {
    unauthorizedTask ??= (async () => {
      saveIntendedRoute(options.getCurrentPath?.() ?? `${window.location.pathname}${window.location.search}`);
      try {
        await options.tokenStore.remove();
      } catch {
        // Continue clearing in-memory state if secure storage is unavailable.
      }
      try {
        await options.clearSessionQuery?.();
      } catch {
        // Navigation must still complete.
      } finally {
        options.navigate?.("/login", { replace: true });
      }
    })().finally(() => { unauthorizedTask = null; });
    await unauthorizedTask;
  }

  async function request<T>(path: string, init: RequestOptions<T> = {}): Promise<T> {
    const { schema, authenticated = true, ...requestInit } = init;
    const headers = new Headers(requestInit.headers);
    headers.set("Accept", "application/json");
    if (requestInit.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (authenticated) {
      const token = await options.tokenStore.get();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetcher(joinUrl(options.baseUrl, path), { ...requestInit, headers });
    } catch {
      throw new ApiClientError("SERVICE_UNAVAILABLE", "无法连接服务器，请检查网络后重试", 0);
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = apiFailureSchema.safeParse(payload);
      const error = failure.success
        ? new ApiClientError(failure.data.error.code, failure.data.error.message, response.status, failure.data.error.fieldErrors)
        : new ApiClientError("INTERNAL_ERROR", "服务器返回了无效响应", response.status);
      if (response.status === 401) await handleUnauthorized();
      throw error;
    }

    const envelope = apiSuccessSchema(schema ?? z.unknown()).safeParse(payload);
    if (!envelope.success) throw new ApiClientError("INTERNAL_ERROR", "服务器返回了无效响应", response.status);
    return envelope.data.data as T;
  }

  return {
    request,
    get: <T>(path: string, init: RequestOptions<T> = {}) => request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init: RequestOptions<T> = {}) => request<T>(path, { ...init, method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
    put: <T>(path: string, body: unknown, init: RequestOptions<T> = {}) => request<T>(path, { ...init, method: "PUT", body: JSON.stringify(body) }),
    delete: <T>(path: string, init: RequestOptions<T> = {}) => request<T>(path, { ...init, method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
