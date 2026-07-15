import { AppFrame } from "@/components/app-frame";
import { CartView } from "@/components/cart-view";
import { SubpageHeader } from "@/components/subpage-header";
import { getTranslator } from "@/lib/i18n-server";
import type { CartKind } from "@/lib/types";

export async function generateMetadata() { const t = await getTranslator(); return { title: t("购物车") }; }
export default async function CartPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const params = await searchParams;
  const kind: CartKind = params.kind === "SHOP" ? "SHOP" : "MENU";
  const t = await getTranslator();
  return <AppFrame><SubpageHeader back={kind === "MENU" ? "/menu" : "/shop"} title={t(kind === "MENU" ? "点单购物车" : "商店购物车")} /><main className="mx-auto max-w-6xl px-5 py-8"><CartView kind={kind} /></main></AppFrame>;
}
