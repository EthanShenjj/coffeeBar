import { createStore } from "zustand/vanilla";

export type Locale = "zh" | "en";
type LocaleState = { locale: Locale; setLocale(locale: Locale): void };

export function createLocaleStore(storage: Pick<Storage, "getItem" | "setItem">) {
  let initial: Locale = "zh";
  try { if (storage.getItem("coffeebar.locale") === "en") initial = "en"; } catch { /* default Chinese */ }
  return createStore<LocaleState>((set) => ({
    locale: initial,
    setLocale(locale) {
      try { storage.setItem("coffeebar.locale", locale); } catch { /* keep in memory */ }
      set({ locale });
    },
  }));
}

export type LocaleStore = ReturnType<typeof createLocaleStore>;
