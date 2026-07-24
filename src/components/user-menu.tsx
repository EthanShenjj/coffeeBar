"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { resetAnalyticsIdentity } from "@/lib/analytics";
import { useI18n } from "@/components/i18n-provider";

export function UserMenu({ name, image }: { name?: string | null; image?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    resetAnalyticsIdentity();
    setOpen(false);
    setPending(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={t("用户菜单")}
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-full border bg-white px-2.5 text-xs hover:bg-zinc-50"
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-zinc-100 bg-cover bg-center text-zinc-700"
          style={image ? { backgroundImage: `url(${image})` } : undefined}
        >
          {!image && <UserRound className="size-4" />}
        </span>
        <span className="hidden max-w-24 truncate sm:inline">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-40 overflow-hidden rounded-2xl border bg-white p-1.5 text-sm shadow-xl shadow-black/10">
          <Link
            href="/profile/settings"
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-zinc-700 hover:bg-zinc-100 hover:text-black"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4" />
            {t("设置")}
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-zinc-700 hover:bg-zinc-100 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            onClick={signOut}
            disabled={pending}
          >
            <LogOut className="size-4" />
            {t("退出")}
          </button>
        </div>
      )}
    </div>
  );
}
