import { Capacitor, registerPlugin } from "@capacitor/core";

export const SESSION_TOKEN_KEY = "coffeebar.session-token";

export interface SessionTokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  remove(): Promise<void>;
}

type SessionTokenPlugin = {
  getToken(): Promise<{ value: string | null }>;
  setToken(options: { value: string }): Promise<void>;
  removeToken(): Promise<void>;
};

const NativeSessionTokenStore = registerPlugin<SessionTokenPlugin>("SessionTokenStore");

export function createBrowserSessionTokenStore(options: { onRead?: () => void } = {}): SessionTokenStore {
  return {
    async get() {
      options.onRead?.();
      return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
    },
    async set(token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    },
    async remove() {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    },
  };
}

export function createNativeSessionTokenStore(plugin: SessionTokenPlugin = NativeSessionTokenStore): SessionTokenStore {
  return {
    async get() {
      const result = await plugin.getToken();
      return result.value;
    },
    set: (token) => plugin.setToken({ value: token }),
    remove: () => plugin.removeToken(),
  };
}

export function createSessionTokenStore(): SessionTokenStore {
  return Capacitor.isNativePlatform() ? createNativeSessionTokenStore() : createBrowserSessionTokenStore();
}
