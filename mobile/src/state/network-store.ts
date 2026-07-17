import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { createStore } from "zustand/vanilla";

export type OnlineOperation = "checkout" | "recharge" | "mark-read" | "push-token";

export class OfflineOperationError extends Error {
  readonly code = "OFFLINE";
  constructor(readonly operation: OnlineOperation) {
    super("当前处于离线状态，请在网络恢复后再试");
    this.name = "OfflineOperationError";
  }
}

type NetworkState = {
  online: boolean;
  recoveryNotice: string | null;
  setOnline(online: boolean): Promise<void>;
  dismissRecoveryNotice(): void;
  requireOnline(operation: OnlineOperation): void;
};

export function createNetworkStore(options: { initialOnline: boolean; onReconnect?: () => Promise<void> | void }) {
  return createStore<NetworkState>((set, get) => ({
    online: options.initialOnline,
    recoveryNotice: null,
    async setOnline(online) {
      const wasOffline = !get().online;
      set({ online, recoveryNotice: online && wasOffline ? "网络已恢复" : null });
      if (online && wasOffline) await options.onReconnect?.();
    },
    dismissRecoveryNotice: () => set({ recoveryNotice: null }),
    requireOnline(operation) {
      if (!get().online) throw new OfflineOperationError(operation);
    },
  }));
}

export async function observeNetwork(store: ReturnType<typeof createNetworkStore>) {
  if (Capacitor.isNativePlatform()) {
    const status = await Network.getStatus();
    await store.getState().setOnline(status.connected);
    const listener = await Network.addListener("networkStatusChange", ({ connected }) => { void store.getState().setOnline(connected); });
    return () => listener.remove();
  }
  const online = () => { void store.getState().setOnline(true); };
  const offline = () => { void store.getState().setOnline(false); };
  await store.getState().setOnline(navigator.onLine);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}
