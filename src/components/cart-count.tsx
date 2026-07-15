"use client";
import type { CartKind } from "@/lib/types";
import { useCartStore } from "@/lib/cart-store";

export function CartCount({ kind }: { kind: CartKind }) {
  const count = useCartStore((state) => (kind === "MENU" ? state.menu : state.shop).reduce((sum, item) => sum + item.quantity, 0));
  if (!count) return null;
  return <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full border-2 border-background bg-white px-1 text-[10px] font-bold text-black">{count}</span>;
}
