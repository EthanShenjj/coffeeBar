import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { useStore } from "zustand";
import { createTranslator } from "../i18n";
import type { AuthController } from "../auth/auth-controller";
import { AppRoutes } from "./App";
import { AppServicesProvider, type AppServices } from "./services";
import { useAuthSnapshot } from "./use-auth";

function ConsentBoundary({ services, auth, queryClient }: { services: AppServices; auth: AuthController; queryClient: QueryClient }) {
  const consent = useStore(services.consent);
  const locale = useStore(services.locale);
  const t = createTranslator(locale.locale);
  const snapshot = useAuthSnapshot(auth);
  if (!consent.decided) return <main className="consent-gate" aria-labelledby="consent-title"><div className="brand">CB/</div><button className="locale" onClick={() => locale.setLocale(locale.locale === "zh" ? "en" : "zh")} aria-label={t("语言切换")}>{locale.locale === "zh" ? "EN" : "中"}</button><p className="eyebrow">YOUR PRIVACY</p><h1 id="consent-title">{t("帮助我们改善 CoffeeBar？")}</h1><p>{t("经你同意后，我们会收集不含 IDFA 的产品使用数据。你可随时在“隐私与账户”中更改选择。")}</p><div className="actions"><button onClick={async () => { await consent.decide(true); await services.analytics.track("analytics_consent", { consent: "granted" }); }}>{t("允许分析数据")}</button><button className="secondary" onClick={() => void consent.decide(false)}>{t("暂不允许")}</button></div></main>;
  return <QueryClientProvider client={queryClient}><BrowserRouter><AppRoutes auth={snapshot} controller={auth} /></BrowserRouter></QueryClientProvider>;
}

export function Root({ auth, queryClient, services }: { auth: AuthController; queryClient: QueryClient; services: AppServices }) {
  return <AppServicesProvider value={services}><ConsentBoundary services={services} auth={auth} queryClient={queryClient} /></AppServicesProvider>;
}
