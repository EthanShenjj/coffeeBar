import { describe, expect, it } from "vitest";
import type { UserConfig } from "vite";
import config from "../../vite.config";

describe("mobile Vite development proxy", () => {
  it("proxies API requests to the production backend with a trusted origin", () => {
    const proxy = (config as UserConfig).server?.proxy?.["/api"];

    expect(proxy).toMatchObject({
      target: "https://coffeebar-navy.vercel.app",
      changeOrigin: true,
      secure: true,
      headers: { origin: "https://coffeebar-navy.vercel.app" },
    });
  });
});
