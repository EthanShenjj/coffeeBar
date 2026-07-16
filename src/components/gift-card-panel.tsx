"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rechargeGiftCard } from "@/actions/gift-card";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GIFT_CARD_RECHARGE_AMOUNTS } from "@/lib/gift-card";
import { formatMoney } from "@/lib/utils";

export function GiftCardPanel({ balance, persistent }: { balance: number; persistent: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function choose(amount: number) {
    setSelected(amount);
    setToken(crypto.randomUUID());
  }

  async function confirmRecharge() {
    if (selected === null || token === null) return;
    setPending(true);
    const result = await rechargeGiftCard({ amount: selected, token });
    setPending(false);
    if (!result.ok) {
      toast.error(t(result.message));
      return;
    }
    toast.success(t("充值成功"));
    setSelected(null);
    setToken(null);
    router.refresh();
  }

  return <>
    <section className="overflow-hidden rounded-[2rem] bg-black p-6 text-white md:p-8">
      <p className="text-xs uppercase tracking-[.2em] text-white/45">CoffeeBar gift card</p>
      <p className="mt-8 text-sm text-white/55">{t("购物卡余额")}</p>
      <p className="mt-2 font-mono text-4xl font-semibold tracking-tight">{formatMoney(balance)}</p>
      {!persistent && <p className="mt-6 text-xs text-white/45">{t("配置数据库后可使用购物卡")}</p>}
    </section>

    <section className="mt-5 rounded-[1.5rem] border bg-white p-6">
      <h2 className="font-semibold">{t("选择充值金额")}</h2>
      <p className="mt-1 text-xs text-zinc-500">{t("模拟充值，不会产生真实扣款")}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {GIFT_CARD_RECHARGE_AMOUNTS.map((amount) => (
          <Button key={amount} type="button" variant="outline" className="font-mono" onClick={() => choose(amount)}>
            {formatMoney(amount)}
          </Button>
        ))}
      </div>
    </section>

    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent>
        <DialogTitle className="text-2xl font-semibold tracking-tight">{t("确认充值")}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-zinc-500">{t("确认后金额将立即存入购物卡。")}</DialogDescription>
        <div className="my-7 rounded-2xl bg-zinc-100 p-5 text-center">
          <p className="font-mono text-4xl font-semibold">{selected === null ? formatMoney(0) : formatMoney(selected)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => setSelected(null)}>{t("再想想")}</Button>
          <Button type="button" onClick={confirmRecharge} disabled={pending || !persistent}>
            {pending ? t("处理中…") : t("确认充值")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
