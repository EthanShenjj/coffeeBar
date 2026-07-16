import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { GiftCardPanel } from "@/components/gift-card-panel";
import { SubpageHeader } from "@/components/subpage-header";
import { getSession } from "@/lib/auth";
import { getGiftCardSummary } from "@/lib/gift-card-data";
import { getLocale, getTranslator } from "@/lib/i18n-server";
import { formatMoney } from "@/lib/utils";

export default async function GiftCardPage() {
  const [session, summary, t, locale] = await Promise.all([
    getSession(),
    getGiftCardSummary(),
    getTranslator(),
    getLocale(),
  ]);
  if (!session) redirect("/login?next=%2Fprofile%2Fgift-card");

  return (
    <AppFrame>
      <SubpageHeader back="/profile" title={t("购物卡")} width="max-w-2xl" />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <GiftCardPanel balance={summary.balance} persistent={summary.persistent} />
        <section className="mt-5 rounded-[1.5rem] border bg-white p-6">
          <h2 className="font-semibold">{t("余额明细")}</h2>
          {summary.transactions.length === 0 ? (
            <p className="mt-5 text-sm text-zinc-500">{t("还没有购物卡记录")}</p>
          ) : (
            <div className="mt-3 divide-y">
              {summary.transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(transaction.type === "RECHARGE" ? "购物卡充值" : "订单消费")}</p>
                    <p className="mt-1 truncate text-xs text-zinc-400">
                      {transaction.order?.orderNumber ?? transaction.createdAt.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" })}
                    </p>
                  </div>
                  <span className={`shrink-0 font-mono font-semibold ${transaction.amount > 0 ? "text-emerald-600" : "text-zinc-900"}`}>
                    {transaction.amount > 0 ? "+" : ""}{formatMoney(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppFrame>
  );
}
