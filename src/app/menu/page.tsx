import { AppFrame } from "@/components/app-frame";
import { ProductBrowser } from "@/components/product-browser";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/auth";
import { getProducts } from "@/lib/catalog";
import { getTranslator } from "@/lib/i18n-server";

export async function generateMetadata() { const t = await getTranslator(); return { title: t("点单") }; }
export default async function MenuPage() {
  const [products, session, t] = await Promise.all([getProducts("MENU"), getSession(), getTranslator()]);
  const [headlineTop, headlineBottom] = t("今天，\n想喝哪一杯？").split("\n");
  return <AppFrame><SiteHeader cartKind="MENU" session={session} /><main className="mx-auto max-w-6xl px-5 py-8 md:py-12"><div className="mb-8 border-b pb-8 md:flex md:items-end md:justify-between"><div><p className="mb-3 text-xs font-medium uppercase tracking-[.24em] text-zinc-400">{t("Coffee menu · 门店自取")}</p><h1 className="display-title max-w-2xl text-5xl font-semibold md:text-7xl">{headlineTop}<br />{headlineBottom}</h1></div><div className="mt-6 flex items-center gap-3 md:mt-0"><span className="flex size-12 items-center justify-center rounded-full bg-black font-mono text-xs text-white">15m</span><p className="text-sm leading-6 text-zinc-500">{t("上海市安福路 108 号")}<br />{t("预计 15 分钟出杯 · 营业至 21:30")}</p></div></div><ProductBrowser products={products} channel="MENU" /></main></AppFrame>;
}
