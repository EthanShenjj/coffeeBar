import { AppFrame } from "@/components/app-frame";
import { ProductBrowser } from "@/components/product-browser";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/auth";
import { getProducts } from "@/lib/catalog";
import { getTranslator } from "@/lib/i18n-server";

export async function generateMetadata() { const t = await getTranslator(); return { title: t("线上商店") }; }
export default async function ShopPage() {
  const [products, session, t] = await Promise.all([getProducts("SHOP"), getSession(), getTranslator()]);
  const [headlineTop, headlineBottom] = t("把咖啡日常\n带回家。").split("\n");
  return <AppFrame><SiteHeader cartKind="SHOP" session={session} /><main className="mx-auto max-w-6xl px-5 py-8 md:py-14"><div className="mb-9"><p className="mb-3 text-xs font-medium uppercase tracking-[.24em] text-zinc-400">Objects for coffee</p><h1 className="display-title text-5xl font-semibold md:text-7xl">{headlineTop}<br />{headlineBottom}</h1><p className="mt-5 max-w-lg text-sm leading-6 text-zinc-500">{t("我们喜欢的杯子与器具，简洁、耐用，全部支持门店自取。")}</p></div><ProductBrowser products={products} channel="SHOP" /></main></AppFrame>;
}
