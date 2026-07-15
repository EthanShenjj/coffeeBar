import Link from "next/link";
import { ChevronRight, History, Settings, Shield, Sparkles } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { CoffeeCalendar } from "@/components/coffee-calendar";
import { SiteHeader } from "@/components/site-header";
import { formatMoney } from "@/lib/utils";
import { getProfileDashboard } from "@/lib/dashboard";
import { getSession } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function ProfilePage() {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);
  const t = createTranslator(locale);

  if (!session) {
    return (
      <AppFrame>
        <SiteHeader session={session} />
        <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-5 py-10">
          <section className="w-full overflow-hidden rounded-[2rem] bg-black px-6 py-10 text-white md:px-12 md:py-14">
            <p className="text-xs uppercase tracking-[.22em] text-white/45">CoffeeBar member</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-.06em] md:text-6xl">{t("登录后，每一杯都算数。")}</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/55">{t("保存历史订单、查看消费统计和会员等级，并在不同设备继续你的点单。")}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?next=%2Fprofile" className="flex min-h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-medium text-black">{t("登录")}</Link>
              <Link href="/register?next=%2Fprofile" className="flex min-h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-medium text-white">{t("创建账号")}</Link>
            </div>
          </section>
        </main>
      </AppFrame>
    );
  }

  const data = await getProfileDashboard();
  const max = Math.max(...data.months, 1);
  const [currentYear, currentMonth] = data.today.split("-").map(Number);
  const monthLabels = Array.from({ length: 6 }, (_, index) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "short" }).format(new Date(Date.UTC(currentYear, currentMonth - 1 - (5 - index), 1))));

  return (
    <AppFrame>
      <SiteHeader session={session} />
      <main className="mx-auto max-w-5xl px-5 py-9">
        <section className="overflow-hidden rounded-[2rem] bg-black p-6 text-white md:p-9">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.2em] text-white/45">CoffeeBar member</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-.05em]">{data.user.name}</h1>
              <p className="mt-1 text-sm text-white/50">{data.user.email}</p>
            </div>
            <div className="flex size-16 items-center justify-center rounded-full border border-white/20 font-mono text-xl">L{data.level.level}</div>
          </div>
          <div className="mt-10">
            <div className="flex justify-between text-xs">
              <span>{t("会员成长")}</span>
              <span className="text-white/50">{data.level.nextThreshold ? t("距 L{level} 还差 {amount}", { level: data.level.level + 1, amount: formatMoney(data.level.nextThreshold - data.totalPaid) }) : t("已达最高等级")}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white" style={{ width: `${data.level.progress}%` }} />
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[[t("累计消费"), formatMoney(data.totalPaid)], [t("本月消费"), formatMoney(data.monthPaid)], [t("历史订单"), t("{count} 单", { count: data.orderCount })], [t("平均客单"), formatMoney(data.average)]].map(([label, value]) => (
            <div key={label} className="rounded-[1.5rem] border bg-white p-5">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-3 font-mono text-xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <div className="mt-5">
          <CoffeeCalendar coffeeDays={data.coffeeDays} today={data.today} />
        </div>

        <section className="mt-5 grid gap-5 md:grid-cols-[1.3fr_1fr]">
          <div className="rounded-[1.5rem] border bg-white p-6">
            <div className="flex justify-between">
              <div>
                <p className="text-sm font-medium">{t("近六个月消费")}</p>
                <p className="mt-1 text-xs text-zinc-400">{t("每一次停下来，都算数。")}</p>
              </div>
              <Sparkles className="size-5 text-zinc-300" />
            </div>
            <div className="mt-7 flex h-36 items-end gap-3">
              {data.months.map((value, index) => (
                <div key={index} className="flex h-full flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-black" style={{ height: `${Math.max(8, value / max * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
              {monthLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
            </div>
          </div>
          <div className="overflow-hidden rounded-[1.5rem] border bg-white">
            {[
              ["/profile/orders", History, t("历史订单")],
              ["/profile/settings", Settings, t("个人设置")],
              ["/profile/security", Shield, t("账号与密码")],
              ...(data.user.role === "ADMIN" ? [["/admin", Shield, t("运营后台")]] : []),
            ].map(([href, Icon, label]) => (
              <Link key={String(href)} href={String(href)} className="flex items-center gap-3 border-b p-5 last:border-0 hover:bg-zinc-50">
                <Icon className="size-4" />
                <span className="flex-1 text-sm">{String(label)}</span>
                <ChevronRight className="size-4 text-zinc-300" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </AppFrame>
  );
}
