import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  amplitude: {
    init: vi.fn(),
    track: vi.fn(),
    setUserId: vi.fn(),
    flush: vi.fn(() => ({ promise: Promise.resolve() })),
  },
  mixpanel: {
    init: vi.fn(),
    track: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    people: { set: vi.fn() },
  },
  posthog: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("@amplitude/analytics-browser", () => mocks.amplitude);
vi.mock("mixpanel-browser", () => ({ default: mocks.mixpanel }));
vi.mock("posthog-js", () => ({ default: mocks.posthog }));

describe("shared browser analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("window", { setTimeout });
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
    vi.stubEnv("NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN", "mixpanel-token");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_public");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  });

  it("forwards existing events and user identity to PostHog", async () => {
    const analytics = await import("@/lib/analytics");

    analytics.trackAnalytics("page_viewed", { page_name: "home" });
    analytics.identifyAnalytics("user-1", { auth_mode: "login" });

    expect(mocks.posthog.capture).toHaveBeenCalledWith("page_viewed", expect.objectContaining({
      app_name: "coffeebar",
      page_name: "home",
    }));
    expect(mocks.posthog.identify).toHaveBeenCalledWith("user-1", { auth_mode: "login" });
  });

  it("resets the PostHog identity on logout", async () => {
    const analytics = await import("@/lib/analytics");

    analytics.resetAnalyticsIdentity();

    expect(mocks.amplitude.setUserId).toHaveBeenCalledWith(undefined);
    expect(mocks.mixpanel.reset).toHaveBeenCalledOnce();
    expect(mocks.posthog.reset).toHaveBeenCalledOnce();
  });
});
