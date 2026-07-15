"use client";

import { createContext, useContext } from "react";
import { createTranslator, type Locale } from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  t: ReturnType<typeof createTranslator>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: createTranslator(locale) }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

