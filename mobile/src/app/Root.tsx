import { QueryClientProvider, useQuery, type QueryClient } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { useStore } from "zustand";
import { createTranslator } from "../i18n";
import type { AuthController } from "../auth/auth-controller";
import { AppRoutes } from "./App";
import { AppServicesProvider, type AppServices } from "./services";
import { useAuthSnapshot } from "./use-auth";
import { compareAppVersions } from "../config/app-version";

function ConfiguredApplication({ services, auth }: { services: AppServices; auth: AuthController }) {
  const locale = useStore(services.locale);
  const network = useStore(services.network);
  const t = createTranslator(locale.locale);
  const snapshot = useAuthSnapshot(auth);
  const config = useQuery({
    queryKey: ["app-config"],
    queryFn: services.customerApi.appConfig,
    enabled: network.online,
    staleTime: 5 * 60_000,
  });
  if (network.online && config.isPending) return <main className="state" role="status">{t("正在检查应用版本…")}</main>;
  if (network.online && config.error) return <main className="state error"><h1>{t("服务暂时不可用")}</h1><p>{t("请检查网络后重试。")}</p><button onClick={() => void config.refetch()}>{t("重试")}</button></main>;
  if (config.data?.maintenance) return <main className="state"><h1>{t("CoffeeBar 正在维护")}</h1><p>{t("我们很快回来，请稍后再试。")}</p><a className="button" href={config.data.supportUrl} target="_blank" rel="noreferrer">{t("帮助与支持")}</a></main>;
  if (services.nativePlatform && config.data && compareAppVersions(services.appVersion ?? "0.0.0", config.data.minimumIosVersion) < 0) {
    return <main className="state"><h1>{t("需要更新 CoffeeBar")}</h1><p>{t("请在 TestFlight 中安装最新版本后继续。")}</p><a className="button" href={config.data.supportUrl} target="_blank" rel="noreferrer">{t("帮助与支持")}</a></main>;
  }
  return <BrowserRouter><AppRoutes auth={snapshot} controller={auth} /></BrowserRouter>;
}

function ConsentBoundary({ services, auth, queryClient }: { services: AppServices; auth: AuthController; queryClient: QueryClient }) {
  const consent = useStore(services.consent);
  const locale = useStore(services.locale);
  const t = createTranslator(locale.locale);
  if (!consent.decided) return <main className="consent-gate" aria-labelledby="consent-title"><div className="brand">CB/</div><button className="locale" onClick={() => locale.setLocale(locale.locale === "zh" ? "en" : "zh")} aria-label={t("语言切换")}>{locale.locale === "zh" ? "EN" : "中"}</button><p className="eyebrow">YOUR PRIVACY</p><h1 id="consent-title">{t("帮助我们改善 CoffeeBar？")}</h1><p>{t("经你同意后，我们会收集不含 IDFA 的产品使用数据。你可随时在“隐私与账户”中更改选择。")}</p><div className="actions"><button onClick={async () => { await consent.decide(true); await services.analytics.track("analytics_consent", { consent: "granted" }); }}>{t("允许分析数据")}</button><button className="secondary" onClick={() => void consent.decide(false)}>{t("暂不允许")}</button></div></main>;
  return <QueryClientProvider client={queryClient}><ConfiguredApplication services={services} auth={auth} /></QueryClientProvider>;
}

export function Root({ auth, queryClient, services }: { auth: AuthController; queryClient: QueryClient; services: AppServices }) {
  return <AppServicesProvider value={services}><ConsentBoundary services={services} auth={auth} queryClient={queryClient} /></AppServicesProvider>;
}
