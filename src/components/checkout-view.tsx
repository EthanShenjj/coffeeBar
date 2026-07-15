"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmCheckout } from "@/actions/checkout";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { lineTotal, useCartStore } from "@/lib/cart-store";
import { formatMoney } from "@/lib/utils";
import type { CartKind, CartLine } from "@/lib/types";

function createPickupTimes() {
  const base = new Date();
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(base.getTime() + (index + 1) * 30 * 60_000);
    date.setSeconds(0, 0);
    return { value: date.toISOString(), label: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}` };
  });
}

export function CheckoutView({ kind, direct }: { kind: CartKind; direct: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const cartLines = useCartStore((state) => kind === "MENU" ? state.menu : state.shop);
  const clear = useCartStore((state) => state.clear);
  const [directLine] = useState<CartLine | null>(() => {
    if (!direct || typeof window === "undefined") return null;
    const value = window.sessionStorage.getItem("coffeebar-direct");
    return value ? JSON.parse(value) as CartLine : null;
  });
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({ pickupName: "", pickupPhone: "", pickupAt: "", note: "" });
  const lines = useMemo(() => direct ? (directLine ? [directLine] : []) : cartLines, [cartLines, direct, directLine]);
  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);
  const [times] = useState(createPickupTimes);

  function openConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (!lines.length) return toast.error(t("没有可结算的商品"));
    if (!/^1\d{10}$/.test(form.pickupPhone)) return toast.error(t("请输入 11 位手机号"));
    if (!form.pickupAt) return toast.error(t("请选择取货时间"));
    setConfirming(true);
  }

  async function pay() {
    setPending(true);
    const result = await confirmCheckout({ token: crypto.randomUUID(), kind, ...form, items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity, optionIds: line.optionIds })) });
    setPending(false);
    if (!result.ok) {
      toast.error(t(result.message));
      if (result.message.includes("登录") || result.message.toLowerCase().includes("sign in")) router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (!direct) clear(kind);
    sessionStorage.removeItem("coffeebar-direct");
    sessionStorage.setItem("coffeebar-last-order", JSON.stringify(result));
    router.push(`/payment/success?order=${encodeURIComponent(result.orderNumber)}&amount=${result.totalAmount}&demo=${result.demo ? "1" : "0"}`);
  }

  return <>
    <form onSubmit={openConfirm} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <section className="rounded-[1.5rem] border bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-black text-white"><MapPin className="size-4" /></div>
            <div><h2 className="font-semibold">{t("门店自取")}</h2><p className="text-xs text-zinc-500">{t("CoffeeBar 安福路店 · 上海市安福路 108 号")}</p></div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-2 block text-zinc-500">{t("取货人")}</span><Input value={form.pickupName} onChange={(event) => setForm({ ...form, pickupName: event.target.value })} placeholder={t("你的姓名")} required /></label>
            <label className="text-sm"><span className="mb-2 block text-zinc-500">{t("联系电话")}</span><Input value={form.pickupPhone} onChange={(event) => setForm({ ...form, pickupPhone: event.target.value })} inputMode="numeric" placeholder={t("11 位手机号")} required /></label>
          </div>
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-zinc-500"><Clock3 className="size-4" />{t("预计取货时间")}</div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">{times.map((time) => <button type="button" key={time.value} onClick={() => setForm({ ...form, pickupAt: time.value })} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${form.pickupAt === time.value ? "border-black bg-black text-white" : "bg-white"}`}>{time.label}</button>)}</div>
          </div>
          <label className="mt-5 block text-sm"><span className="mb-2 block text-zinc-500">{t("订单备注")}</span><Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={t("如有特殊需求，请告诉我们")} maxLength={200} /></label>
        </section>
        <section className="rounded-[1.5rem] border bg-white p-6">
          <h2 className="font-semibold">{t("商品明细")}</h2>
          <div className="mt-4 divide-y">{lines.map((line) => <div key={line.lineId} className="flex justify-between gap-4 py-4 text-sm"><div><p className="font-medium">{t(line.product.name)} × {line.quantity}</p><p className="mt-1 text-xs text-zinc-400">{line.product.optionGroups.flatMap((group) => group.options).filter((option) => line.optionIds.includes(option.id)).map((option) => t(option.name)).join(" · ")}</p></div><span className="font-mono">{formatMoney(lineTotal(line))}</span></div>)}</div>
        </section>
      </div>
      <aside className="h-fit rounded-[1.5rem] border bg-white p-6 lg:sticky lg:top-6">
        <p className="text-xs uppercase tracking-[.2em] text-zinc-400">Payment summary</p>
        <div className="mt-5 flex items-end justify-between"><span className="text-sm text-zinc-500">{t("应付金额")}</span><span className="font-mono text-3xl font-semibold tracking-tight">{formatMoney(total)}</span></div>
        <div className="mt-6 space-y-3 border-t pt-5 text-xs text-zinc-500"><p className="flex items-center gap-2"><ShieldCheck className="size-4" />{t("模拟支付，不会产生真实扣款")}</p><p>{t("点击支付后将再次确认金额。")}</p></div>
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={!lines.length}>{t("确认支付")}</Button>
      </aside>
    </form>
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <DialogContent>
        <DialogTitle className="text-2xl font-semibold tracking-tight">{t("确认模拟支付")}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-zinc-500">{t("确认后将立即生成已支付订单，并保存本次实付金额。")}</DialogDescription>
        <div className="my-7 rounded-2xl bg-zinc-100 p-5 text-center"><p className="text-xs text-zinc-500">{t("本次支付")}</p><p className="mt-2 font-mono text-4xl font-semibold">{formatMoney(total)}</p></div>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setConfirming(false)}>{t("再想想")}</Button><Button onClick={pay} disabled={pending}>{pending ? t("处理中…") : t("确认支付")}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
