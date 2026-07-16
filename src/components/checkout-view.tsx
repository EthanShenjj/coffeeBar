"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmCheckout } from "@/actions/checkout";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { lineTotal, useCartStore } from "@/lib/cart-store";
import { flushAnalytics, trackAnalytics } from "@/lib/analytics";
import { calculatePaymentSplit } from "@/lib/gift-card";
import { trackAppliedGiftCardPayment, trackGiftCardPaymentToggle } from "@/lib/gift-card-analytics";
import { formatMoney } from "@/lib/utils";
import type { CartKind, CartLine } from "@/lib/types";

const DIRECT_CHECKOUT_STORAGE_KEY = "coffeebar-direct";
const LAST_ORDER_STORAGE_KEY = "coffeebar-last-order";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCartLine(value: unknown, kind: CartKind): value is CartLine {
  if (!isRecord(value) || typeof value.lineId !== "string" || !Number.isSafeInteger(value.quantity) || (value.quantity as number) < 1) return false;
  if (!Array.isArray(value.optionIds) || !value.optionIds.every((optionId) => typeof optionId === "string")) return false;
  if (!isRecord(value.product)) return false;

  const product = value.product;
  if (typeof product.id !== "string" || typeof product.slug !== "string" || typeof product.name !== "string" || typeof product.subtitle !== "string" || typeof product.description !== "string") return false;
  if (product.channel !== kind || typeof product.category !== "string" || !Number.isSafeInteger(product.price) || (product.price as number) < 0 || typeof product.imageUrl !== "string" || typeof product.isAvailable !== "boolean") return false;
  if (product.stock !== null && (!Number.isSafeInteger(product.stock) || (product.stock as number) < 0)) return false;
  if (!Array.isArray(product.optionGroups)) return false;

  return product.optionGroups.every((group) => {
    if (!isRecord(group) || typeof group.id !== "string" || typeof group.name !== "string" || typeof group.required !== "boolean" || !Number.isSafeInteger(group.maxSelect)) return false;
    if (!Array.isArray(group.options)) return false;
    return group.options.every((option) => isRecord(option)
      && typeof option.id === "string"
      && typeof option.name === "string"
      && Number.isSafeInteger(option.priceDelta)
      && (option.isDefault === undefined || typeof option.isDefault === "boolean"));
  });
}

function removeSessionStorageItem(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage cleanup is best-effort (for example, in privacy-restricted browsers).
  }
}

function readDirectCheckoutLine(kind: CartKind) {
  if (typeof window === "undefined") return null;
  try {
    const storedValue = window.sessionStorage.getItem(DIRECT_CHECKOUT_STORAGE_KEY);
    if (storedValue === null) return null;
    const parsed: unknown = JSON.parse(storedValue);
    if (isCartLine(parsed, kind)) return parsed;
  } catch {
    // Invalid or inaccessible storage is handled like a missing direct checkout.
  }
  removeSessionStorageItem(DIRECT_CHECKOUT_STORAGE_KEY);
  return null;
}

function checkoutIntentStorageKey(kind: CartKind, direct: boolean) {
  return `coffeebar-checkout-intent:${kind}:${direct ? "direct" : "cart"}`;
}

function createPickupTimes() {
  const base = new Date();
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(base.getTime() + (index + 1) * 30 * 60_000);
    date.setSeconds(0, 0);
    return { value: date.toISOString(), label: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}` };
  });
}

function checkoutFailureCode(message: string) {
  const lower = message.toLowerCase();
  if (message.includes("登录") || lower.includes("sign in")) return "auth_required";
  if (message.includes("库存")) return "out_of_stock";
  if (message.includes("下架") || message.includes("失效")) return "product_unavailable";
  if (message.includes("规格") || message.includes("请选择")) return "option_invalid";
  return "unknown";
}

export function CheckoutView({ kind, direct, giftCardBalance, giftCardPersistent }: { kind: CartKind; direct: boolean; giftCardBalance: number; giftCardPersistent: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const cartLines = useCartStore((state) => kind === "MENU" ? state.menu : state.shop);
  const clear = useCartStore((state) => state.clear);
  const [directLine] = useState<CartLine | null>(() => direct ? readDirectCheckoutLine(kind) : null);
  const checkoutTokenRef = useRef<string | null>(null);
  const intentStorageKey = checkoutIntentStorageKey(kind, direct);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [useGiftCard, setUseGiftCard] = useState(false);
  const [form, setForm] = useState({ pickupName: "", pickupPhone: "", pickupAt: "", note: "" });
  const checkoutTracked = useRef(false);
  const lines = useMemo(() => direct ? (directLine ? [directLine] : []) : cartLines, [cartLines, direct, directLine]);
  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);
  const split = useMemo(() => calculatePaymentSplit(total, giftCardBalance, useGiftCard), [giftCardBalance, total, useGiftCard]);
  const [times] = useState(createPickupTimes);
  const checkoutProperties = useMemo(() => ({
    product_channel: kind,
    checkout_mode: direct ? "direct" : "cart",
    item_count: lines.length,
    quantity_total: lines.reduce((sum, line) => sum + line.quantity, 0),
    cart_amount_cents: total,
  }), [direct, kind, lines, total]);

  useEffect(() => {
    if (checkoutTracked.current || !lines.length) return;
    checkoutTracked.current = true;
    trackAnalytics("checkout_started", checkoutProperties);
  }, [checkoutProperties, lines.length]);

  function openConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (!lines.length) return toast.error(t("没有可结算的商品"));
    if (!/^1\d{10}$/.test(form.pickupPhone)) return toast.error(t("请输入 11 位手机号"));
    if (!form.pickupAt) return toast.error(t("请选择取货时间"));
    trackAnalytics("checkout_form_submitted", { ...checkoutProperties, has_note: Boolean(form.note.trim()), pickup_lead_time_minutes: Math.max(0, Math.round((new Date(form.pickupAt).getTime() - Date.now()) / 60_000)) });
    setConfirming(true);
  }

  function toggleGiftCard(enabled: boolean) {
    trackGiftCardPaymentToggle({ enabled, balance: giftCardBalance, orderAmount: total });
    setUseGiftCard(enabled);
  }

  async function pay() {
    setPending(true);
    trackAnalytics("payment_submitted", checkoutProperties);
    try {
      let token = checkoutTokenRef.current;
      if (!token) {
        try {
          const storedToken = window.sessionStorage.getItem(intentStorageKey);
          if (storedToken && UUID_PATTERN.test(storedToken)) token = storedToken;
        } catch {
          // The in-memory token still keeps retries stable when storage is unavailable.
        }
        token ??= crypto.randomUUID();
        checkoutTokenRef.current = token;
        try {
          window.sessionStorage.setItem(intentStorageKey, token);
        } catch {
          // Persistence across reloads is best-effort; the ref covers this page lifetime.
        }
      }

      const result = await confirmCheckout({ token, kind, ...form, useGiftCard, items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity, optionIds: line.optionIds })) });
      if (!result.ok) {
        trackAnalytics("order_payment_failed", { ...checkoutProperties, failure_code: checkoutFailureCode(result.message) });
        toast.error(t(result.message));
        if (result.message.includes("登录") || result.message.toLowerCase().includes("sign in")) router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }

      trackAppliedGiftCardPayment({
        orderId: result.orderId,
        productChannel: kind,
        orderAmount: result.totalAmount,
        giftCardAmount: result.giftCardAmount,
        externalAmount: result.externalAmount,
      });
      trackAnalytics("order_payment_succeeded", { ...checkoutProperties, order_id: result.orderId, order_amount_cents: result.totalAmount, is_demo: result.demo });
      await flushAnalytics();

      const successParams = new URLSearchParams({
        order: result.orderNumber,
        amount: String(result.totalAmount),
        giftCard: String(result.giftCardAmount),
        external: String(result.externalAmount),
        demo: result.demo ? "1" : "0",
      });
      const successUrl = `/payment/success?${successParams.toString()}`;

      checkoutTokenRef.current = null;
      removeSessionStorageItem(intentStorageKey);
      if (!direct) {
        try {
          clear(kind);
        } catch {
          // A completed checkout must still navigate if persisted cart cleanup fails.
        }
      }
      removeSessionStorageItem(DIRECT_CHECKOUT_STORAGE_KEY);
      try {
        window.sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(result));
      } catch {
        // Preserve navigation even when the optional order snapshot cannot be stored.
      }
      router.push(successUrl);
    } catch {
      toast.error(t("支付未完成，请稍后重试"));
    } finally {
      setPending(false);
    }
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
        <div className="mt-5 rounded-2xl bg-zinc-100 p-4">
          <label className={`flex items-center justify-between gap-3 ${giftCardPersistent && giftCardBalance > 0 ? "cursor-pointer" : "cursor-not-allowed text-zinc-400"}`}>
            <span className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={useGiftCard} onChange={(event) => toggleGiftCard(event.target.checked)} disabled={!giftCardPersistent || giftCardBalance <= 0} className="size-4 accent-black" />{t("使用购物卡")}</span>
            <span className="font-mono text-sm">{formatMoney(giftCardBalance)}</span>
          </label>
          {useGiftCard && <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-sm"><p className="flex items-center justify-between text-zinc-500"><span>{t("购物卡支付")}</span><span className="font-mono">{formatMoney(split.giftCardAmount)}</span></p><p className="flex items-center justify-between text-zinc-500"><span>{t("模拟付费")}</span><span className="font-mono">{formatMoney(split.externalAmount)}</span></p></div>}
        </div>
        <div className="mt-6 space-y-3 border-t pt-5 text-xs text-zinc-500"><p className="flex items-center gap-2"><ShieldCheck className="size-4" />{t("模拟支付，不会产生真实扣款")}</p><p>{t("点击支付后将再次确认金额。")}</p></div>
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={!lines.length}>{t("确认支付")}</Button>
      </aside>
    </form>
    <Dialog open={confirming} onOpenChange={(open) => { if (!pending || open) setConfirming(open); }}>
      <DialogContent onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogTitle className="text-2xl font-semibold tracking-tight">{t("确认模拟支付")}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-zinc-500">{t("确认后将立即生成已支付订单，并保存本次实付金额。")}</DialogDescription>
        <div className="my-7 rounded-2xl bg-zinc-100 p-5 text-center"><p className="text-xs text-zinc-500">{t("本次支付")}</p><p className="mt-2 font-mono text-4xl font-semibold">{formatMoney(total)}</p></div>
        {useGiftCard && <div className="mb-7 space-y-2 rounded-2xl border border-zinc-200 p-4 text-sm"><p className="flex items-center justify-between text-zinc-500"><span>{t("购物卡支付")}</span><span className="font-mono">{formatMoney(split.giftCardAmount)}</span></p><p className="flex items-center justify-between text-zinc-500"><span>{t("模拟付费")}</span><span className="font-mono">{formatMoney(split.externalAmount)}</span></p></div>}
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>{t("再想想")}</Button><Button onClick={pay} disabled={pending}>{pending ? t("处理中…") : t("确认支付")}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
