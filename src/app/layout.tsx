import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/i18n-server";
import { createTranslator } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = createTranslator(locale);
  return {
    title: { default: "CoffeeBar", template: "%s · CoffeeBar" },
    description: t("一杯咖啡，从容抵达。移动点单、门店自取与咖啡生活商店。"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"} data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <I18nProvider locale={locale}>
          <AnalyticsProvider>{children}</AnalyticsProvider>
          <Toaster position="top-center" richColors />
        </I18nProvider>
      </body>
      <Script
        src="https://cdn.amplitude.com/script/32a30ec9e86b7dd4d0225cb76bfbd509.experiment.js"
        strategy="beforeInteractive"
      />
    </html>
  );
}
