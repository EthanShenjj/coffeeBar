import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/thinkingdata/experiment/fetch/route";

const originalFetchUrl = process.env.THINKINGDATA_EXPERIMENT_FETCH_URL;

afterEach(() => {
  process.env.THINKINGDATA_EXPERIMENT_FETCH_URL = originalFetchUrl;
  vi.unstubAllGlobals();
});

describe("ThinkingData experiment fetch proxy", () => {
  it("fails closed when the experiment endpoint is not configured", async () => {
    delete process.env.THINKINGDATA_EXPERIMENT_FETCH_URL;
    const response = await POST(new Request("https://coffeebar.test/api/thinkingdata/experiment/fetch", {
      method: "POST",
      body: JSON.stringify({ "#distinct_id": "visitor-1" }),
    }));

    expect(response.status).toBe(503);
  });

  it("forwards the documented fetch body without caching", async () => {
    process.env.THINKINGDATA_EXPERIMENT_FETCH_URL = "https://experiment.example.test/fetch?appid=app-1";
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ feature: "value" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", upstream);

    const body = {
      "#account_id": "account-1",
      "#distinct_id": "visitor-1",
      "#feature_key": ["login_registration_copy"],
      "#lib": "tga_js_sdk",
    };
    const response = await POST(new Request("https://coffeebar.test/api/thinkingdata/experiment/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledWith(new URL(process.env.THINKINGDATA_EXPERIMENT_FETCH_URL), expect.objectContaining({
      method: "POST",
      body: JSON.stringify(body),
      cache: "no-store",
    }));
  });

  it("rejects requests without an account or distinct identity", async () => {
    process.env.THINKINGDATA_EXPERIMENT_FETCH_URL = "https://experiment.example.test/fetch?appid=app-1";
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await POST(new Request("https://coffeebar.test/api/thinkingdata/experiment/fetch", {
      method: "POST",
      body: JSON.stringify({ "#feature_key": ["color"], "#lib": "tga_js_sdk" }),
    }));

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent fetches with the same user and payload", async () => {
    process.env.THINKINGDATA_EXPERIMENT_FETCH_URL = "https://experiment.example.test/fetch?appid=app-1";
    let resolve!: (response: Response) => void;
    const upstream = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", upstream);
    const body = JSON.stringify({ "#distinct_id": "visitor-1", "#feature_key": ["color"], "#lib": "tga_js_sdk" });

    const first = POST(new Request("https://coffeebar.test/api/thinkingdata/experiment/fetch", { method: "POST", body }));
    const second = POST(new Request("https://coffeebar.test/api/thinkingdata/experiment/fetch", { method: "POST", body }));
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledOnce());
    resolve(new Response(JSON.stringify({ color: "red" }), { status: 200 }));

    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
  });
});
