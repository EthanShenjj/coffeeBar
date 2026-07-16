"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { ProductArtwork } from "@/components/product-browser";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { lineTotal, useCartStore } from "@/lib/cart-store";
import { trackAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/utils";
import type { CartKind } from "@/lib/types";

export function CartView({ kind }: { kind: CartKind }) {
  const { t } = useI18n();
  const lines = useCartStore((state) => kind === "MENU" ? state.menu : state.shop);
  const update = useCartStore((state) => state.update);
  const remove = useCartStore((state) => state.remove);
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const cartProperties = useMemo(() => ({
    product_channel: kind,
    item_count: lines.length,
    quantity_total: lines.reduce((sum, line) => sum + line.quantity, 0),
    cart_amount_cents: total,
  }), [kind, lines, total]);
  const back = kind === "MENU" ? "/menu" : "/shop";
  useEffect(() => {
    trackAnalytics("cart_viewed", cartProperties);
  }, [cartProperties]);
  if (!lines.length) return <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center"><div className="mb-5 flex size-20 items-center justify-center rounded-full bg-zinc-100 text-3xl">☕</div><h2 className="text-xl font-semibold">{t("购物车还是空的")}</h2><p className="mt-2 text-sm text-zinc-500">{t("去挑一杯今天想喝的，或者带一件咖啡器具回家。")}</p><Button asChild className="mt-6"><Link href={back}>{t("去逛逛")}</Link></Button></div>;
  return <div className="grid gap-8 lg:grid-cols-[1fr_360px]"><div className="space-y-3">{lines.map((line) => { const optionNames = line.product.optionGroups.flatMap((group) => group.options).filter((option) => line.optionIds.includes(option.id)).map((option) => t(option.name)); return <div key={line.lineId} className="flex gap-4 rounded-[1.5rem] border bg-white p-4"><div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100"><ProductArtwork product={line.product} variant="row" /></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><h3 className="font-medium">{t(line.product.name)}</h3><p className="mt-1 line-clamp-1 text-xs text-zinc-500">{optionNames.join(" · ") || t(line.product.subtitle)}</p></div><button onClick={() => { trackAnalytics("cart_item_removed", { product_channel: kind, product_id: line.product.id, quantity: line.quantity, item_amount_cents: lineTotal(line) }); remove(kind, line.lineId); }} className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100" aria-label={t("删除")}><Trash2 className="size-4" /></button></div><div className="mt-4 flex items-center justify-between"><span className="font-mono text-sm font-medium">{formatMoney(lineTotal(line))}</span><div className="flex items-center gap-3"><button onClick={() => { trackAnalytics("cart_item_quantity_changed", { product_channel: kind, product_id: line.product.id, quantity: line.quantity - 1 }); update(kind, line.lineId, line.quantity - 1); }} className="flex size-8 items-center justify-center rounded-full bg-zinc-100"><Minus className="size-3.5" /></button><span className="font-mono text-sm">{line.quantity}</span><button onClick={() => { trackAnalytics("cart_item_quantity_changed", { product_channel: kind, product_id: line.product.id, quantity: line.quantity + 1 }); update(kind, line.lineId, line.quantity + 1); }} className="flex size-8 items-center justify-center rounded-full bg-zinc-100"><Plus className="size-3.5" /></button></div></div></div></div>; })}</div><aside className="h-fit rounded-[1.5rem] border bg-white p-6 lg:sticky lg:top-24"><h2 className="text-lg font-semibold">{t("订单小计")}</h2><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-zinc-500"><span>{t("商品")}</span><span>{formatMoney(total)}</span></div><div className="flex justify-between text-zinc-500"><span>{t("自取服务")}</span><span>{t("免费")}</span></div><div className="flex justify-between border-t pt-4 text-lg font-semibold"><span>{t("合计")}</span><span className="font-mono">{formatMoney(total)}</span></div></div><Button asChild size="lg" className="mt-6 w-full"><Link href={`/checkout?kind=${kind}`}>{t("去结算")}</Link></Button><p className="mt-3 text-center text-[11px] text-zinc-400">{t("仅支持 CoffeeBar 安福路店自取")}</p></aside></div>;
}
