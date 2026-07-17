"use client";

import * as amplitude from "@amplitude/analytics-browser";
import mixpanel from "mixpanel-browser";
import type { ProductView } from "@/lib/types";

type AnalyticsValue = string | number | boolean | null | undefined | string[] | number[] | boolean[];
export type AnalyticsProperties = Record<string, AnalyticsValue>;

const amplitudeApiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
const mixpanelProjectToken = process.env.NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN;
const thinkingDataAppId = process.env.NEXT_PUBLIC_THINKINGDATA_APP_ID;
const thinkingDataServerUrl = process.env.NEXT_PUBLIC_THINKINGDATA_SERVER_URL;
const thinkingDataEnabled = Boolean(thinkingDataAppId && thinkingDataServerUrl);
const enabled = Boolean(amplitudeApiKey || mixpanelProjectToken || thinkingDataEnabled);

let initialized = false;
type ThinkingDataClient = {
  init: (config: Record<string, unknown>) => void;
  track: (eventName: string, eventProperties?: Record<string, unknown>) => void;
  login: (accountId: string) => void;
  getAccountId?: () => string;
  getDistinctId?: () => string;
  userSet: (userProperties: Record<string, unknown>) => void;
  flush: () => void;
};

declare global {
  interface Window {
    thinkingdata?: ThinkingDataClient;
  }
}

let thinkingDataClient: ThinkingDataClient | null = null;
let thinkingDataLoading: Promise<ThinkingDataClient | null> | null = null;
let thinkingDataInitialized = false;
let pendingThinkingDataEvents: Array<{ eventName: string; payload: AnalyticsProperties }> = [];
let pendingThinkingDataIdentity: { userId: string; properties: AnalyticsProperties } | null = null;
const thinkingDataScriptSrc = "/vendor/thinkingdata.umd.min.js";

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

function initThinkingData() {
  if (!thinkingDataEnabled || typeof window === "undefined") return;

  if (window.thinkingdata) {
    initializeThinkingDataClient(window.thinkingdata);
    return;
  }

  if (thinkingDataLoading) return;

  thinkingDataLoading = new Promise<ThinkingDataClient | null>((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${thinkingDataScriptSrc}"]`);

    function complete() {
      const client = window.thinkingdata ?? null;
      if (client) initializeThinkingDataClient(client);
      resolve(client);
    }

    if (existingScript) {
      existingScript.addEventListener("load", complete, { once: true });
      existingScript.addEventListener("error", () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = thinkingDataScriptSrc;
    script.async = true;
    script.dataset.analyticsVendor = "thinkingdata";
    script.addEventListener("load", complete, { once: true });
    script.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(script);
  });
}

function initializeThinkingDataClient(client: ThinkingDataClient) {
  if (thinkingDataInitialized) return;

  try {
    client.init({
      appId: thinkingDataAppId,
      serverUrl: thinkingDataServerUrl,
      autoTrack: false,
      batch: false,
      disableRConfig: true,
      send_method: "ajax",
      showLog: process.env.NODE_ENV !== "production",
    });
    thinkingDataClient = client;
    thinkingDataInitialized = true;

    if (pendingThinkingDataIdentity) {
      client.login(pendingThinkingDataIdentity.userId);
      if (Object.keys(pendingThinkingDataIdentity.properties).length) {
        client.userSet(pendingThinkingDataIdentity.properties);
      }
      pendingThinkingDataIdentity = null;
    }
    pendingThinkingDataEvents.forEach((event) => client.track(event.eventName, event.payload));
    pendingThinkingDataEvents = [];
  } catch {
    thinkingDataClient = null;
  }
}

function trackThinkingData(eventName: string, payload: AnalyticsProperties) {
  if (!thinkingDataEnabled) return;
  initThinkingData();
  if (thinkingDataClient) {
    thinkingDataClient.track(eventName, payload);
    return;
  }
  pendingThinkingDataEvents.push({ eventName, payload });
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

  initThinkingData();

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
  trackThinkingData(eventName, payload);
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
  if (thinkingDataEnabled) {
    initThinkingData();
    if (thinkingDataClient) {
      thinkingDataClient.login(userId);
      if (Object.keys(payload).length) thinkingDataClient.userSet(payload);
    } else {
      pendingThinkingDataIdentity = { userId, properties: payload };
    }
  }
}

export async function getThinkingDataIdentity(timeoutMs = 500) {
  if (!thinkingDataEnabled || typeof window === "undefined") return {};
  initAnalytics();
  const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs));
  const client = thinkingDataClient
    ?? await Promise.race([thinkingDataLoading ?? Promise.resolve(null), timeout]);
  return {
    accountId: client?.getAccountId?.() || undefined,
    distinctId: client?.getDistinctId?.() || undefined,
  };
}

export function trackThinkingDataExperimentExposure(detail: {
  experimentId: string;
  experimentGroupId: string;
  isControlGroup: boolean;
}) {
  trackThinkingData("te_experiment_exposure", {
    "#experiment_id": detail.experimentId,
    "#experiment_group_id": detail.experimentGroupId,
    "#is_control_group": detail.isControlGroup,
  });
}

export async function flushAnalytics(timeoutMs = 800) {
  if (!enabled || !initialized) return;
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs));
  const tasks: Promise<unknown>[] = [];
  if (amplitudeApiKey) tasks.push(amplitude.flush().promise.catch(() => undefined));
  if (thinkingDataEnabled) {
    initThinkingData();
    if (thinkingDataLoading) tasks.push(thinkingDataLoading.then((client) => client?.flush()).catch(() => undefined));
    if (thinkingDataClient) thinkingDataClient.flush();
  }
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
