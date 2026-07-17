import { createAnalyticsConsentStore } from "./consent-store";
import { createMobileAnalytics, type AnalyticsClient, type AnalyticsVendors } from "./mobile-analytics";

describe("mobile analytics consent gate", () => {
  it("does not initialize or track before explicit consent and adds iOS build context afterwards", async () => {
    const consent = createAnalyticsConsentStore(window.localStorage);
    const vendors: AnalyticsVendors = {
      load: vi.fn(async () => ({ resume: vi.fn(), track: vi.fn(), reset: vi.fn(), dispose: vi.fn() })),
    };
    const analytics = createMobileAnalytics({
      consent,
      vendors,
      config: { amplitudeKey: "a", mixpanelToken: "m", thinkingDataAppId: "t", thinkingDataServerUrl: "https://ta.example.com" },
      appVersion: "1.2.3",
      buildNumber: "45",
    });

    await analytics.track("product_viewed", { product_id: "p1" });
    expect(vendors.load).not.toHaveBeenCalled();
    await consent.getState().decide(true);
    await analytics.track("add_to_cart", { product_id: "p1" });
    expect(vendors.load).toHaveBeenCalledOnce();
    const client = await vi.mocked(vendors.load).mock.results[0]!.value;
    expect(client.track).toHaveBeenCalledWith("add_to_cart", expect.objectContaining({
      platform: "ios", app_version: "1.2.3", build_number: "45", product_id: "p1",
    }));

    await consent.getState().decide(false);
    expect(client.reset).toHaveBeenCalledOnce();
    expect(client.dispose).toHaveBeenCalledOnce();
    await analytics.track("checkout_started");
    expect(client.track).toHaveBeenCalledTimes(1);

    await consent.getState().decide(true);
    await analytics.track("page_viewed", { page_name: "home" });
    expect(vendors.load).toHaveBeenCalledTimes(2);
    const resumed = await vi.mocked(vendors.load).mock.results[1]!.value;
    expect(resumed.resume).toHaveBeenCalledOnce();
    expect(resumed.track).toHaveBeenCalledWith("page_viewed", expect.objectContaining({ platform: "ios" }));
  });

  it("persists undecided separately from denied and defaults to disabled", async () => {
    const consent = createAnalyticsConsentStore(window.localStorage);
    expect(consent.getState()).toMatchObject({ decided: false, allowed: false });
    await consent.getState().decide(false);
    expect(JSON.parse(window.localStorage.getItem("coffeebar.analytics-consent")!)).toEqual({ version: 1, allowed: false });
    const restored = createAnalyticsConsentStore(window.localStorage);
    expect(restored.getState()).toMatchObject({ decided: true, allowed: false });
  });

  it("does not emit an event when consent is withdrawn while SDKs are loading", async () => {
    const consent = createAnalyticsConsentStore(window.localStorage); await consent.getState().decide(true);
    let finish!: (client: AnalyticsClient) => void;
    const client: AnalyticsClient = { resume: vi.fn(), track: vi.fn(), reset: vi.fn(), dispose: vi.fn() };
    const vendors: AnalyticsVendors = { load: vi.fn(() => new Promise<AnalyticsClient>((resolve) => { finish = resolve; })) };
    const analytics = createMobileAnalytics({ consent, vendors, config: { amplitudeKey: "a" }, appVersion: "1", buildNumber: "1" });
    const tracking = analytics.track("product_viewed");
    await consent.getState().decide(false); finish(client); await tracking;
    expect(client.track).not.toHaveBeenCalled(); expect(client.reset).toHaveBeenCalledOnce(); expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("never blocks product actions when an analytics SDK cannot load", async () => {
    const consent = createAnalyticsConsentStore(window.localStorage); await consent.getState().decide(true);
    const analytics = createMobileAnalytics({ consent, vendors: { load: vi.fn(async () => { throw new Error("vendor down"); }) }, config: { amplitudeKey: "a" }, appVersion: "1", buildNumber: "1" });
    await expect(analytics.track("login")).resolves.toBeUndefined();
  });
});
