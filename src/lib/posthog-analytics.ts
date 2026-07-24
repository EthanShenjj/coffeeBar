export type PostHogBrowserClient = {
  init(token: string, options: Record<string, unknown>): void;
  capture(eventName: string, properties?: Record<string, unknown>): void;
  identify(userId: string, properties?: Record<string, unknown>): void;
  reset(): void;
};

type PostHogAnalyticsConfig = {
  token?: string;
  host?: string;
};

export function createPostHogAnalytics(
  client: PostHogBrowserClient,
  config: PostHogAnalyticsConfig,
) {
  const token = config.token?.trim();
  const host = config.host?.trim().replace(/\/$/, "");
  const enabled = Boolean(token && host);
  let initialized = false;

  function init() {
    if (!enabled || initialized) return;
    client.init(token!, {
      api_host: host,
      defaults: "2026-05-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
    });
    initialized = true;
  }

  return {
    init,
    capture(eventName: string, properties?: Record<string, unknown>) {
      if (!enabled) return;
      init();
      client.capture(eventName, properties);
    },
    identify(userId: string, properties?: Record<string, unknown>) {
      if (!enabled) return;
      init();
      client.identify(userId, properties);
    },
    reset() {
      if (!enabled) return;
      init();
      client.reset();
    },
  };
}
