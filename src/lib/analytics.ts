"use client";

import * as amplitude from "@amplitude/analytics-browser";
import mixpanel from "mixpanel-browser";
import type { ProductView } from "@/lib/types";

type AnalyticsValue = string | number | boolean | null | undefined | string[] | number[] | boolean[];
export type AnalyticsProperties = Record<string, AnalyticsValue>;

const amplitudeApiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
const mixpanelProjectToken = process.env.NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN;
const enabled = Boolean(amplitudeApiKey || mixpanelProjectToken);

let initialized = false;

function cleanProperties(properties: AnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function baseProperties() {
  return cleanProperties({
    app_name: "coffeebar",
    event_version: 1,
    environment: process.env.NODE_ENV,
  });
}

export function initAnalytics() {
  if (typeof window === "undefined" || initialized || !enabled) return;

  if (amplitudeApiKey) {
    amplitude.init(amplitudeApiKey, {
      autocapture: false,
      flushIntervalMillis: 1000,
      flushQueueSize: 10,
    });
  }

  if (mixpanelProjectToken) {
    mixpanel.init(mixpanelProjectToken, {
      api_transport: "sendBeacon",
      debug: process.env.NODE_ENV !== "production",
      persistence: "localStorage",
      track_pageview: false,
    });
  }

  initialized = true;
}

export function trackAnalytics(eventName: string, properties: AnalyticsProperties = {}) {
  if (!enabled) return;
  initAnalytics();

  const payload = cleanProperties({
    ...baseProperties(),
    ...properties,
  });

  if (amplitudeApiKey) amplitude.track(eventName, payload);
  if (mixpanelProjectToken) mixpanel.track(eventName, payload);
}

export function identifyAnalytics(userId?: string | null, properties: AnalyticsProperties = {}) {
  if (!enabled || !userId) return;
  initAnalytics();

  const payload = cleanProperties(properties);
  if (amplitudeApiKey) {
    amplitude.setUserId(userId);
  }
  if (mixpanelProjectToken) {
    mixpanel.identify(userId);
    if (Object.keys(payload).length) mixpanel.people.set(payload);
  }
}

export async function flushAnalytics(timeoutMs = 800) {
  if (!enabled || !initialized) return;
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs));
  const tasks: Promise<unknown>[] = [];
  if (amplitudeApiKey) tasks.push(amplitude.flush().promise.catch(() => undefined));
  await Promise.race([Promise.all(tasks), timeout]);
}

export function productAnalyticsProperties(product: ProductView) {
  return cleanProperties({
    product_id: product.id,
    product_slug: product.slug,
    product_channel: product.channel,
    product_category: product.category,
    menu_section: product.menuSection,
    base_price_cents: product.price,
    has_options: product.optionGroups.length > 0,
    stock_state: product.stock === null ? "unlimited" : product.stock <= 0 ? "out_of_stock" : product.stock < 10 ? "low_stock" : "in_stock",
  });
}
