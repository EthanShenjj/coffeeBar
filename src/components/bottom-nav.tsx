"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Coffee, House, ShoppingBag, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

const nav = [
  { href: "/", label: "首页", icon: House },
  { href: "/menu", label: "点单", icon: Coffee },
  { href: "/shop", label: "商店", icon: ShoppingBag },
  { href: "/messages", label: "消息", icon: Bell },
  { href: "/profile", label: "我的", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  if (pathname.startsWith("/admin") || pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/checkout")) return null;
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-3 pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px]", active ? "font-semibold text-black" : "text-zinc-400")}><Icon className={cn("size-5", active && "stroke-[2.4]")} />{t(label)}</Link>;
        })}
      </div>
    </nav>
  );
}
