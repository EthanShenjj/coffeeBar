import type { AnalyticsConsentStore } from "./consent-store";

export type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsValue>;
export type AnalyticsClient = {
  resume(): void;
  track(event: string, properties: Record<string, Exclude<AnalyticsValue, undefined>>): void;
  reset(): void;
  dispose(): void;
};
export type AnalyticsVendors = { load(config: AnalyticsConfig): Promise<AnalyticsClient> };
export type AnalyticsConfig = {
  amplitudeKey?: string;
  mixpanelToken?: string;
  thinkingDataAppId?: string;
  thinkingDataServerUrl?: string;
};

function clean(properties: AnalyticsProperties) {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined)) as Record<string, Exclude<AnalyticsValue, undefined>>;
}

export function createMobileAnalytics(options: {
  consent: AnalyticsConsentStore;
  vendors: AnalyticsVendors;
  config: AnalyticsConfig;
  appVersion: string;
  buildNumber: string;
}) {
  let client: AnalyticsClient | null = null;
  let loading: Promise<AnalyticsClient> | null = null;
  let consentGeneration = 0;
  const discarded = new WeakSet<AnalyticsClient>();
  const configured = Object.values(options.config).some(Boolean);
  function discard(value: AnalyticsClient | null) {
    if (!value || discarded.has(value)) return;
    discarded.add(value);
    try { value.reset(); } catch { /* best-effort vendor identity cleanup */ }
    try { value.dispose(); } catch { /* consent is still disabled in app state */ }
  }
  async function getClient() {
    if (!configured || !options.consent.getState().allowed) return null;
    if (client) return client;
    const generation = consentGeneration;
    const currentLoad = loading ?? options.vendors.load(options.config);
    loading = currentLoad;
    let loaded: AnalyticsClient;
    try { loaded = await currentLoad; } catch {
      if (loading === currentLoad) loading = null;
      return null;
    }
    if (generation !== consentGeneration || !options.consent.getState().allowed) {
      discard(loaded);
      return null;
    }
    try { loaded.resume(); } catch { /* a broken vendor must not block consent */ }
    client = loaded;
    return client;
  }
  options.consent.subscribe((state, previous) => {
    if (previous.allowed && !state.allowed) {
      consentGeneration += 1;
      discard(client);
      client = null;
      loading = null;
    }
  });
  return {
    async track(event: string, properties: AnalyticsProperties = {}) {
      const active = await getClient();
      try {
        active?.track(event, clean({
          app_name: "coffeebar",
          event_version: 1,
          platform: "ios",
          app_version: options.appVersion,
          build_number: options.buildNumber,
          ...properties,
        }));
      } catch { /* analytics must never block customer actions */ }
    },
  };
}

export type MobileAnalytics = ReturnType<typeof createMobileAnalytics>;

export const browserAnalyticsVendors: AnalyticsVendors = {
  async load(config) {
    const [amplitudeModule, mixpanelModule, thinkingModule] = await Promise.all([
      config.amplitudeKey ? import("@amplitude/analytics-browser") : null,
      config.mixpanelToken ? import("mixpanel-browser") : null,
      config.thinkingDataAppId && config.thinkingDataServerUrl ? import("thinkingdata-browser") : null,
    ]);
    const amplitude = amplitudeModule;
    const mixpanel = mixpanelModule?.default;
    const thinking = thinkingModule?.default;
    if (amplitude && config.amplitudeKey) amplitude.init(config.amplitudeKey, { autocapture: false });
    if (mixpanel && config.mixpanelToken) mixpanel.init(config.mixpanelToken, { persistence: "localStorage", track_pageview: false });
    if (thinking && config.thinkingDataAppId && config.thinkingDataServerUrl) {
      thinking.init({ appId: config.thinkingDataAppId, serverUrl: config.thinkingDataServerUrl, autoTrack: false, batch: false });
    }
    return {
      resume() {
        try { amplitude?.setOptOut(false); } catch { /* independent vendors */ }
        try { mixpanel?.opt_in_tracking(); } catch { /* independent vendors */ }
        try { thinking?.optInTracking(); } catch { /* independent vendors */ }
      },
      track(event, properties) {
        try { amplitude?.track(event, properties); } catch { /* independent vendors */ }
        try { mixpanel?.track(event, properties); } catch { /* independent vendors */ }
        try { thinking?.track(event, properties); } catch { /* independent vendors */ }
      },
      reset() {
        try { amplitude?.reset(); } catch { /* independent vendors */ }
        try { mixpanel?.reset(); } catch { /* independent vendors */ }
        try { thinking?.logout(true); } catch { /* independent vendors */ }
        try { thinking?.clearSuperProperties(); } catch { /* independent vendors */ }
      },
      dispose() {
        try { amplitude?.setOptOut(true); } catch { /* independent vendors */ }
        try { mixpanel?.opt_out_tracking(); } catch { /* independent vendors */ }
        try { thinking?.optOutTracking(); } catch { /* independent vendors */ }
      },
    };
  },
};
