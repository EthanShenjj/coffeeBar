import { describe, expect, it, vi } from "vitest";
import { createThinkingDataServerAbSdk } from "@/lib/thinkingdata-ab-server";

const experiment = (id: string) => ({
  value: `value-${id}`,
  experiment_detail: {
    "#experiment_id": id,
    "#experiment_group_id": "treatment",
    "#is_control_group": false,
  },
});

describe("ThinkingData server AB SDK", () => {
  it("fetches in real time without caching feature results", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ strategy: "first" })
      .mockResolvedValueOnce({ strategy: "second" });
    const sdk = createThinkingDataServerAbSdk({ fetcher, lib: "tga_node_sdk" });

    const first = await sdk.fetch({ accountId: "user-1", distinctId: "visitor-1" }, ["strategy"], {
      bucketId: { tenant: "coffee" },
    });
    const second = await sdk.fetch({ accountId: "user-1", distinctId: "visitor-1" }, ["strategy"]);

    expect(first.getValueAsString("strategy", "default")).toBe("first");
    expect(second.getValueAsString("strategy", "default")).toBe("second");
    expect(fetcher).toHaveBeenNthCalledWith(1, {
      "#account_id": "user-1",
      "#distinct_id": "visitor-1",
      custom_bucketid: { tenant: "coffee" },
      "#feature_key": ["strategy"],
      "#lib": "tga_node_sdk",
    }, expect.any(AbortSignal));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent fetches for the same user and request", async () => {
    let resolve!: (value: unknown) => void;
    const fetcher = vi.fn(() => new Promise<unknown>((done) => { resolve = done; }));
    const sdk = createThinkingDataServerAbSdk({ fetcher });

    const first = sdk.fetch({ distinctId: "visitor-1" }, ["strategy"]);
    const second = sdk.fetch({ distinctId: "visitor-1" }, ["strategy"]);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    resolve({ strategy: "shared" });

    const [a, b] = await Promise.all([first, second]);
    expect(a.getValueAsString("strategy", "default")).toBe("shared");
    expect(b.getValueAsString("strategy", "default")).toBe("shared");
  });

  it("retries transient fetch failures up to three attempts", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("network one"))
      .mockRejectedValueOnce(new Error("network two"))
      .mockResolvedValueOnce({ strategy: "recovered" });
    const sdk = createThinkingDataServerAbSdk({ fetcher });

    const result = await sdk.fetch({ accountId: "user-1" }, ["strategy"]);

    expect(result.getValueAsString("strategy", "default")).toBe("recovered");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("requires explicit exposure and deduplicates it with a bounded TTL cache", async () => {
    let time = 1_000;
    const trackExposure = vi.fn();
    const sdk = createThinkingDataServerAbSdk({
      fetcher: async (body) => ({ feature: experiment(String(body["#account_id"])) }),
      trackExposure,
      now: () => time,
      eventCacheSize: 2,
      eventCacheTimeMs: 10_000,
    });

    const first = await sdk.fetch({ accountId: "one" }, ["feature"]);
    expect(first.getValueAsString("feature", "fallback")).toBe("value-one");
    expect(trackExposure).not.toHaveBeenCalled();
    expect(first.expose("feature", { page: "checkout" })).toBe(true);
    expect(first.expose("feature")).toBe(false);

    const second = await sdk.fetch({ accountId: "two" }, ["feature"]);
    const third = await sdk.fetch({ accountId: "three" }, ["feature"]);
    second.expose("feature");
    third.expose("feature");
    expect(first.expose("feature")).toBe(true);

    time += 10_001;
    expect(third.expose("feature")).toBe(true);
    expect(trackExposure).toHaveBeenCalledWith(expect.objectContaining({
      identity: { accountId: "one" },
      properties: { page: "checkout" },
      experiment: expect.objectContaining({ experimentId: "one" }),
    }));
  });

  it("rejects a request without account or distinct identity", async () => {
    const fetcher = vi.fn();
    const sdk = createThinkingDataServerAbSdk({ fetcher });

    await expect(sdk.fetch({})).rejects.toThrow("accountId or distinctId");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
