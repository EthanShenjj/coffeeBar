import { describe, expect, it, vi } from "vitest";
import { createPostHogAnalytics, type PostHogBrowserClient } from "@/lib/posthog-analytics";

function client() {
  return {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  } satisfies PostHogBrowserClient;
}

describe("PostHog analytics adapter", () => {
  it("stays disabled when the public project configuration is incomplete", () => {
    const posthog = client();
    const analytics = createPostHogAnalytics(posthog, { token: "", host: "https://us.i.posthog.com" });

    analytics.init();
    analytics.capture("page_viewed", { page_name: "home" });
    analytics.identify("user-1", { auth_mode: "login" });
    analytics.reset();

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it("initializes once with privacy-preserving manual capture settings", () => {
    const posthog = client();
    const analytics = createPostHogAnalytics(posthog, {
      token: "phc_public",
      host: "https://us.i.posthog.com/",
    });

    analytics.init();
    analytics.init();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledWith("phc_public", {
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
    });
  });

  it("forwards CoffeeBar events and identity lifecycle", () => {
    const posthog = client();
    const analytics = createPostHogAnalytics(posthog, {
      token: "phc_public",
      host: "https://us.i.posthog.com",
    });

    analytics.capture("checkout_started", { cart_kind: "menu" });
    analytics.identify("user-1", { auth_mode: "login" });
    analytics.reset();

    expect(posthog.capture).toHaveBeenCalledWith("checkout_started", { cart_kind: "menu" });
    expect(posthog.identify).toHaveBeenCalledWith("user-1", { auth_mode: "login" });
    expect(posthog.reset).toHaveBeenCalledOnce();
  });
});
