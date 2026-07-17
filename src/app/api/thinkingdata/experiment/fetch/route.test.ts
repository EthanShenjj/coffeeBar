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
      "#feature_key": ["登录页注册引导文案"],
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
});
