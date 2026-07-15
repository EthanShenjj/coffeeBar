import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslator } from "@/lib/i18n-server";

export async function SubpageHeader({ back, title, width = "max-w-6xl" }: { back: string; title: string; width?: string }) {
  const t = await getTranslator();
  return (
    <header className="border-b bg-white">
      <div className={`mx-auto flex h-16 items-center px-5 ${width}`}>
        <Link href={back} className="mr-4 flex size-10 items-center justify-center rounded-full bg-zinc-100" aria-label={t("返回")}>
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
