import { z } from "zod";
import { createStore } from "zustand/vanilla";

const KEY = "coffeebar.analytics-consent";
const savedSchema = z.object({ version: z.literal(1), allowed: z.boolean() }).strict();

type ConsentState = {
  decided: boolean;
  allowed: boolean;
  decide(allowed: boolean): Promise<void>;
};

export function createAnalyticsConsentStore(storage: Pick<Storage, "getItem" | "setItem">) {
  let saved: z.output<typeof savedSchema> | null = null;
  try {
    const raw = storage.getItem(KEY);
    if (raw) saved = savedSchema.safeParse(JSON.parse(raw)).data ?? null;
  } catch { /* Privacy consent remains safely disabled when storage is unavailable. */ }
  return createStore<ConsentState>((set) => ({
    decided: saved !== null,
    allowed: saved?.allowed ?? false,
    async decide(allowed) {
      try { storage.setItem(KEY, JSON.stringify({ version: 1, allowed })); } catch { /* keep in-memory choice */ }
      set({ decided: true, allowed });
    },
  }));
}

export type AnalyticsConsentStore = ReturnType<typeof createAnalyticsConsentStore>;
