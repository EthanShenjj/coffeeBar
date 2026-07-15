"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/actions/locale";
import { useI18n } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ inverted = false }: { inverted?: boolean }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();

  function changeLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;
    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <div
      className={cn("flex h-9 items-center rounded-full border p-0.5", inverted ? "border-white/20 bg-white/10" : "bg-white")}
      role="group"
      aria-label={t("语言切换")}
    >
      {(["zh", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => changeLocale(value)}
          disabled={pending}
          aria-pressed={locale === value}
          aria-label={value === "zh" ? t("中文") : t("英文")}
          className={cn(
            "flex h-7 min-w-8 items-center justify-center rounded-full px-2 text-[10px] font-semibold transition",
            locale === value
              ? inverted ? "bg-white text-black" : "bg-black text-white"
              : inverted ? "text-white/55 hover:text-white" : "text-zinc-400 hover:text-black",
          )}
        >
          {value === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  );
}
