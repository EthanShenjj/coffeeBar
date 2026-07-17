import { describe, expect, it, vi } from "vitest";
import { createThinkingDataAbSdk, type ThinkingDataAbStorage } from "@/lib/thinkingdata-ab-sdk";

function memoryStorage(): ThinkingDataAbStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("ThinkingData AB SDK", () => {
  it("fetches with documented identities, custom bucket IDs, params, and feature keys", async () => {
    const fetcher = vi.fn(async () => ({ color: "red" }));
    const sdk = createThinkingDataAbSdk({
      appId: "app-1",
      identity: () => ({ accountId: "account-1", distinctId: "visitor-1", deviceId: "device-1" }),
      fetcher,
    });
    sdk.setBucketId({ member_id: "member-1" });
    sdk.setCustomFetchParams({ country: "JP", "#app_version": "5.2.1", "#account_id": "must-not-override" });

    await sdk.fetch(["color"]);

    expect(fetcher).toHaveBeenCalledWith({
      "#account_id": "account-1",
      "#distinct_id": "visitor-1",
      "#device_id": "device-1",
      "#custom_bucketid": { member_id: "member-1" },
      "#feature_key": ["color"],
      "#lib": "tga_js_sdk",
      country: "JP",
      "#app_version": "5.2.1",
    });
  });

  it("provides typed getters and client fallbacks", async () => {
    const sdk = createThinkingDataAbSdk({
      appId: "app-1",
      identity: () => ({ distinctId: "visitor-1" }),
      fetcher: async () => ({ color: "red", weight: 1.2, enabled: true, layout: { cta: "join" }, serialized: "{\"cta\":\"register\"}" }),
    });
    await sdk.fetch();

    expect(sdk.getValueAsString("color", "black")).toBe("red");
    expect(sdk.getValueAsDouble("weight", 0)).toBe(1.2);
    expect(sdk.getValueAsBoolean("enabled", false)).toBe(true);
    expect(sdk.getJson("layout", {})).toEqual({ cta: "join" });
    expect(sdk.getJson("serialized", {})).toEqual({ cta: "register" });
    expect(sdk.getValueAsString("missing", "fallback")).toBe("fallback");
    expect(sdk.getAllValues()).toEqual({ color: "red", weight: 1.2, enabled: true, layout: { cta: "join" }, serialized: "{\"cta\":\"register\"}" });
  });

  it("exposes only when a used feature hits an experiment and deduplicates by bucket, experiment, and group", async () => {
    const trackExposure = vi.fn();
    const sdk = createThinkingDataAbSdk({
      appId: "app-1",
      identity: () => ({ distinctId: "visitor-1" }),
      fetcher: async () => ({
        title: "A",
        cta: "Join",
        experiment_detail: [{
          feature_list: ["title", "cta"],
          bucket_id: { member_id: "member-1" },
          "#experiment_id": "exp-1",
          "#experiment_group_id": "treatment",
          "#is_control_group": false,
        }],
      }),
      trackExposure,
      storage: memoryStorage(),
    });

    await sdk.fetch();
    expect(trackExposure).not.toHaveBeenCalled();
    expect(sdk.peekFeature("title")).toEqual(expect.objectContaining({ value: "A", experiment: expect.objectContaining({ experimentId: "exp-1" }) }));
    expect(trackExposure).not.toHaveBeenCalled();
    expect(sdk.getValueAsString("title", "fallback")).toBe("A");
    expect(sdk.getValueAsString("cta", "fallback")).toBe("Join");
    expect(trackExposure).toHaveBeenCalledOnce();
    expect(trackExposure).toHaveBeenCalledWith(expect.objectContaining({
      experimentId: "exp-1",
      experimentGroupId: "treatment",
      isControlGroup: false,
      bucketId: { member_id: "member-1" },
    }));
  });

  it("supports manual exposure when automatic exposure is disabled", async () => {
    const trackExposure = vi.fn();
    const sdk = createThinkingDataAbSdk({
      appId: "app-1",
      identity: () => ({ distinctId: "visitor-1" }),
      automaticExposureTracking: false,
      fetcher: async () => ({
        feature: { value: true, experiment_detail: { "#experiment_id": "exp-2", "#experiment_group_id": "control", "#is_control_group": true } },
      }),
      trackExposure,
      storage: memoryStorage(),
    });
    await sdk.fetch(["feature"]);

    expect(sdk.getValueAsBoolean("feature", false)).toBe(true);
    expect(trackExposure).not.toHaveBeenCalled();
    expect(sdk.expose("feature")).toBe(true);
    expect(sdk.expose("feature")).toBe(false);
    expect(trackExposure).toHaveBeenCalledOnce();
    expect(trackExposure).toHaveBeenCalledWith(expect.objectContaining({ bucketId: { "#distinct_id": "visitor-1" } }));
  });

  it("restores a successful result from the 12-hour cache", async () => {
    const storage = memoryStorage();
    const first = createThinkingDataAbSdk({
      appId: "app-1", identity: () => ({ distinctId: "visitor-1" }), storage,
      now: () => 1_000, fetcher: async () => ({ color: "red" }),
    });
    await first.fetch(["color"]);

    const remote = vi.fn(async () => ({ color: "blue" }));
    const restored = createThinkingDataAbSdk({
      appId: "app-1", identity: () => ({ distinctId: "visitor-1" }), storage,
      now: () => 1_000 + 12 * 60 * 60 * 1000 - 1, fetcher: remote,
    });
    expect(restored.getValueAsString("color", "black")).toBe("red");
    expect(remote).not.toHaveBeenCalled();
  });

  it("restores cache for an asynchronously resolved identity", async () => {
    const storage = memoryStorage();
    const first = createThinkingDataAbSdk({
      appId: "app-1", identity: () => ({ distinctId: "visitor-1" }), storage,
      now: () => 1_000, fetcher: async () => ({ color: "red" }),
    });
    await first.fetch(["color"]);
    const restored = createThinkingDataAbSdk({
      appId: "app-1", identity: async () => ({ distinctId: "visitor-1" }), storage,
      now: () => 2_000, fetcher: vi.fn(async () => ({ color: "blue" })),
    });

    expect(await restored.restore()).toBe(true);
    expect(restored.getValueAsString("color", "black")).toBe("red");
  });

  it("stops using an expired cache and triggers a background fetch", async () => {
    const storage = memoryStorage();
    const first = createThinkingDataAbSdk({
      appId: "app-1", identity: () => ({ distinctId: "visitor-1" }), storage,
      now: () => 1_000, fetcher: async () => ({ color: "red" }),
    });
    await first.fetch(["color"]);
    const remote = vi.fn(async () => ({ color: "blue" }));
    const expired = createThinkingDataAbSdk({
      appId: "app-1", identity: () => ({ distinctId: "visitor-1" }), storage,
      now: () => 1_000 + 12 * 60 * 60 * 1000, fetcher: remote,
    });

    expect(expired.getValueAsString("color", "black")).toBe("black");
    await vi.waitFor(() => expect(remote).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(expired.getValueAsString("color", "black")).toBe("blue"));
  });

  it("deduplicates concurrent fetches for the same SDK instance", async () => {
    let resolve!: (value: unknown) => void;
    const fetcher = vi.fn(() => new Promise<unknown>((done) => { resolve = done; }));
    const sdk = createThinkingDataAbSdk({ appId: "app-1", identity: () => ({ distinctId: "visitor-1" }), fetcher });
    const first = sdk.fetch(["color"]);
    const second = sdk.fetch(["color"]);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    resolve({ color: "red" });
    await Promise.all([first, second]);
  });
});
