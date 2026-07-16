import { CheckoutView } from "@/components/checkout-view";
import { SubpageHeader } from "@/components/subpage-header";
import { getGiftCardSummary } from "@/lib/gift-card-data";
import { getTranslator } from "@/lib/i18n-server";
import type { CartKind } from "@/lib/types";

export async function generateMetadata() { const t = await getTranslator(); return { title: t("确认订单") }; }
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ kind?: string; direct?: string }> }) { const [params, t, giftCard] = await Promise.all([searchParams, getTranslator(), getGiftCardSummary(0)]); const kind: CartKind = params.kind === "SHOP" ? "SHOP" : "MENU"; return <main className="min-h-screen"><SubpageHeader back={kind === "MENU" ? "/menu" : "/shop"} title={t("确认订单")} /><div className="mx-auto max-w-6xl px-5 py-8"><CheckoutView kind={kind} direct={params.direct === "1"} giftCardBalance={giftCard.balance} giftCardPersistent={giftCard.persistent} /></div></main>; }
