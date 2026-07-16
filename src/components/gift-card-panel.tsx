"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rechargeGiftCard } from "@/actions/gift-card";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GIFT_CARD_RECHARGE_AMOUNTS } from "@/lib/gift-card";
import { giftCardAnalytics, rechargeGiftCardWithAnalytics } from "@/lib/gift-card-analytics";
import { formatMoney } from "@/lib/utils";

export function GiftCardPanel({ balance, persistent }: { balance: number; persistent: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const viewedTracked = useRef(false);

  useEffect(() => {
    if (viewedTracked.current) return;
    viewedTracked.current = true;
    giftCardAnalytics.viewed({ balance, persistent });
  }, [balance, persistent]);

  function choose(amount: number) {
    giftCardAnalytics.amountSelected({ amount, balance });
    setSelected(amount);
    setToken(crypto.randomUUID());
  }

  async function confirmRecharge() {
    if (selected === null || token === null) return;
    setPending(true);
    try {
      const result = await rechargeGiftCardWithAnalytics({
        recharge: rechargeGiftCard,
        amount: selected,
        balance,
        token,
      });
      if (!result.ok) {
        toast.error(t(result.message));
        return;
      }
      toast.success(t("充值成功"));
      setSelected(null);
      setToken(null);
      router.refresh();
    } catch {
      toast.error(t("充值失败，请稍后重试"));
    } finally {
      setPending(false);
    }
  }

  return <>
    <section className="overflow-hidden rounded-[2rem] bg-black p-7 text-white md:p-9">
      <p className="text-xs uppercase tracking-[.22em] text-white/45">CoffeeBar gift card</p>
      <p className="mt-6 text-sm text-white/55">{t("购物卡余额")}</p>
      <p className="mt-2 font-mono text-4xl font-semibold">{formatMoney(balance)}</p>
      {!persistent && <p className="mt-4 text-xs text-amber-200">{t("配置数据库后可使用购物卡")}</p>}
    </section>

    <section className="mt-5 rounded-[1.5rem] border bg-white p-6">
      <h2 className="font-semibold">{t("选择充值金额")}</h2>
      <p className="mt-1 text-xs text-zinc-500">{t("模拟充值，不会产生真实扣款")}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {GIFT_CARD_RECHARGE_AMOUNTS.map((amount) => (
          <button key={amount} type="button" className="min-h-20 rounded-2xl border bg-white font-mono text-xl font-semibold hover:border-black" onClick={() => choose(amount)}>
            {formatMoney(amount)}
          </button>
        ))}
      </div>
    </section>

    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !pending) setSelected(null); }}>
      <DialogContent>
        <DialogTitle className="text-2xl font-semibold">{t("确认充值")}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-zinc-500">{t("确认后金额将立即存入购物卡。")}</DialogDescription>
        <p className="my-7 text-center font-mono text-4xl font-semibold">{formatMoney(selected ?? 0)}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={pending}>{t("再想想")}</Button>
          <Button type="button" onClick={confirmRecharge} disabled={pending || !persistent}>
            {pending ? t("处理中…") : t("确认充值")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
