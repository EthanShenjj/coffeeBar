import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { CartCount } from "@/components/cart-count";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserMenu } from "@/components/user-menu";
import { getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n-server";
import type { CartKind } from "@/lib/types";

type Session = Awaited<ReturnType<typeof getSession>>;

export async function SiteHeader({ cartKind = "MENU", session: providedSession }: { cartKind?: CartKind; session?: Session }) {
  const [session, t] = await Promise.all([providedSession === undefined ? getSession() : providedSession, getTranslator()]);
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="text-lg font-semibold tracking-[-0.06em]">COFFEEBAR<span className="ml-1 text-zinc-400">/</span></Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {session ? <UserMenu name={session.user.name} image={session.user.image} /> : <Link href="/login" className="hidden h-11 items-center rounded-full border bg-white px-4 text-xs font-medium hover:bg-zinc-50 sm:flex">{t("登录 / 注册")}</Link>}
          <Link href={`/cart?kind=${cartKind}`} className="relative flex size-11 items-center justify-center rounded-full bg-black text-white" aria-label={t("购物车")}>
            <ShoppingBag className="size-4" />
            <CartCount kind={cartKind} />
          </Link>
        </div>
      </div>
    </header>
  );
}
