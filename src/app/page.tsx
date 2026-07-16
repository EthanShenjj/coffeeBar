import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { SiteHeader } from "@/components/site-header";
import { TrackedLink } from "@/components/tracked-link";
import { getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n-server";
import { cn } from "@/lib/utils";

export async function generateMetadata() { const t = await getTranslator(); return { title: t("首页") }; }

const coffeeShortcuts = [
  { name: "经典美式", note: "清爽平衡", position: "0% 0%", tone: "bg-black text-white" },
  { name: "拿铁", note: "柔滑醇厚", position: "33.333% 0%", tone: "bg-white" },
  { name: "果咖", note: "明亮清甜", position: "0% 50%", tone: "bg-white" },
  { name: "手冲咖啡", note: "每周换豆", position: "66.667% 50%", tone: "bg-[#eee5d5]" },
] as const;

export default async function HomePage() {
  const [session, t] = await Promise.all([getSession(), getTranslator()]);
  const [headlineTop, headlineBottom] = t("一杯咖啡，\n从容抵达。").split("\n");

  return <AppFrame>
    <SiteHeader cartKind="MENU" session={session} />
    <main>
      <section className="mx-auto max-w-6xl px-5 pb-12 pt-8 md:pb-16 md:pt-14">
        <div className="grid overflow-hidden rounded-[2rem] border bg-white lg:grid-cols-[1.05fr_.95fr]">
          <div className="flex flex-col justify-center p-7 md:p-12 lg:min-h-[590px] lg:p-14">
            <p className="text-xs font-medium uppercase tracking-[.24em] text-zinc-400">CoffeeBar · Anfu Road</p>
            <h1 className="display-title mt-6 text-6xl font-semibold md:text-8xl">{headlineTop}<br />{headlineBottom}</h1>
            <p className="mt-7 max-w-md text-sm leading-7 text-zinc-500 md:text-base">{t("认真做每一杯，也认真留出一点不着急的时间。线上点单，到店即取。")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedLink href="/menu" eventName="home_cta_clicked" eventProperties={{ cta_name: "order_now", target_path: "/menu" }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white transition hover:bg-zinc-800">{t("立即点单")}<ArrowRight className="size-4" /></TrackedLink>
              <TrackedLink href="/shop" eventName="home_cta_clicked" eventProperties={{ cta_name: "shop_now", target_path: "/shop" }} className="inline-flex min-h-12 items-center justify-center rounded-full border bg-white px-6 text-sm font-medium transition hover:bg-zinc-50">{t("逛逛商店")}</TrackedLink>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t pt-6 text-xs text-zinc-500">
              <span className="flex items-center gap-2"><Clock3 className="size-4 text-black" />{t("预计 15 分钟出杯")}</span>
              <span className="flex items-center gap-2"><MapPin className="size-4 text-black" />{t("上海市安福路 108 号")}</span>
            </div>
          </div>

          <div className="relative min-h-[430px] overflow-hidden bg-black p-6 md:min-h-[520px] md:p-9 lg:min-h-[590px]">
            <div className="absolute inset-6 rounded-[1.6rem] border border-white/15 md:inset-9" />
            <div className="absolute left-10 top-10 z-10 md:left-14 md:top-14"><p className="text-xs font-medium uppercase tracking-[.22em] text-white/45">Today&apos;s coffee</p><p className="mt-2 text-xl font-medium text-white">{t("经典，从第一杯开始。")}</p></div>
            <div className="absolute inset-x-[14%] bottom-[12%] aspect-square overflow-hidden rounded-[1.75rem] bg-[#f5efe4] shadow-2xl shadow-black/30 md:inset-x-[18%] md:bottom-[8%]">
              <CoffeeArtwork position="0% 0%" />
            </div>
            <div className="absolute bottom-10 right-10 z-10 flex size-16 items-center justify-center rounded-full bg-white text-center font-mono text-[10px] leading-4 md:bottom-14 md:right-14">15 MIN<br />PICKUP</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[.22em] text-zinc-400">Start here</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.045em] md:text-4xl">{t("今天想喝什么？")}</h2></div><TrackedLink href="/menu" eventName="home_cta_clicked" eventProperties={{ cta_name: "full_menu", target_path: "/menu" }} className="hidden items-center gap-2 text-sm font-medium sm:flex">{t("查看完整菜单")}<ArrowRight className="size-4" /></TrackedLink></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{coffeeShortcuts.map((item) => <TrackedLink href="/menu" eventName="home_cta_clicked" eventProperties={{ cta_name: "coffee_shortcut", shortcut_name: item.name, target_path: "/menu" }} key={item.name} className={cn("group overflow-hidden rounded-[1.5rem] border p-3 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5", item.tone)}>
          <div className="relative aspect-square overflow-hidden rounded-[1.1rem] bg-[#f5efe4]"><CoffeeArtwork position={item.position} /></div>
          <div className="flex items-end justify-between gap-3 px-1 pb-1 pt-4"><div><h3 className="font-medium">{t(item.name)}</h3><p className={cn("mt-1 text-xs", item.tone.includes("text-white") ? "text-white/55" : "text-zinc-500")}>{t(item.note)}</p></div><ArrowRight className="mb-1 size-4 transition group-hover:translate-x-1" /></div>
        </TrackedLink>)}</div>
      </section>

      <section className="bg-black text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.2fr_1fr_1fr] md:py-20">
          <div><p className="text-xs font-medium uppercase tracking-[.22em] text-white/40">Coffee, no rush</p><h2 className="mt-4 max-w-sm text-4xl font-semibold tracking-[-.05em]">{t("路过、停下，带走今天的一杯。")}</h2></div>
          <div className="border-t border-white/15 pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0"><p className="font-mono text-3xl">15m</p><p className="mt-3 text-sm leading-6 text-white/55">{t("提前点单，预计十五分钟出杯，到店直接取走。")}</p></div>
          <div className="border-t border-white/15 pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0"><p className="text-lg font-medium">10:00—21:30</p><p className="mt-3 text-sm leading-6 text-white/55">{t("每天营业，上海市安福路 108 号。")}</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 md:py-20">
        <div className="flex flex-col gap-6 rounded-[2rem] border bg-white p-7 md:flex-row md:items-center md:justify-between md:p-12"><div><p className="text-xs font-medium uppercase tracking-[.22em] text-zinc-400">Objects for coffee</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em]">{t("把咖啡日常带回家。")}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">{t("杯子、滤杯和磨豆机，简洁耐用，支持门店自取。")}</p></div><TrackedLink href="/shop" eventName="home_cta_clicked" eventProperties={{ cta_name: "shop_section", target_path: "/shop" }} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white">{t("进入商店")}<ArrowRight className="size-4" /></TrackedLink></div>
      </section>
    </main>
  </AppFrame>;
}

function CoffeeArtwork({ position }: { position: string }) {
  return <div role="img" aria-label="手绘咖啡插画" className="absolute inset-0 bg-no-repeat" style={{ backgroundImage: "url('/illustrations/coffee-menu-handdrawn.png')", backgroundPosition: position, backgroundSize: "400% 300%" }} />;
}
