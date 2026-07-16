"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initAnalytics, trackAnalytics } from "@/lib/analytics";

const pageNames: Record<string, string> = {
  "/": "home",
  "/menu": "menu",
  "/shop": "shop",
  "/cart": "cart",
  "/checkout": "checkout",
  "/login": "login",
  "/register": "register",
  "/messages": "messages",
  "/payment/success": "payment_success",
  "/profile": "profile",
  "/profile/orders": "profile_orders",
  "/profile/security": "profile_security",
  "/profile/settings": "profile_settings",
};

function allowedQueryProperties(searchParams: URLSearchParams) {
  return {
    query_kind: searchParams.get("kind") ?? undefined,
    query_direct: searchParams.get("direct") === "1" || undefined,
    query_demo: searchParams.get("demo") === "1" || undefined,
    has_query: Array.from(searchParams.keys()).length > 0,
  };
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackAnalytics("page_viewed", {
      page_name: pageNames[pathname] ?? "unknown",
      path: pathname,
      ...allowedQueryProperties(searchParams),
    });
  }, [pathname, searchParams]);

  return children;
}
