import { describe, expect, it, vi } from "vitest";
import { initializeDeepLinks, parseCoffeeBarUrl } from "./deep-links";

describe("CoffeeBar deep links", () => {
  it("accepts only the supported order and message routes", () => {
    expect(parseCoffeeBarUrl("coffeebar://orders/order_123")).toBe("/orders/order_123");
    expect(parseCoffeeBarUrl("coffeebar://messages/msg-456")).toBe("/messages/msg-456");
    expect(parseCoffeeBarUrl("https://example.com/orders/order_123")).toBeNull();
    expect(parseCoffeeBarUrl("coffeebar://orders/a/b")).toBeNull();
    expect(parseCoffeeBarUrl("coffeebar://settings/account")).toBeNull();
    expect(parseCoffeeBarUrl("not a url")).toBeNull();
  });

  it("handles cold-start and warm deep links and removes its listener", async () => {
    const navigate = vi.fn();
    const remove = vi.fn(async () => undefined);
    let opened: ((event: { url: string }) => void) | undefined;
    const dispose = await initializeDeepLinks({
      app: {
        getLaunchUrl: vi.fn(async () => ({ url: "coffeebar://orders/cold-order" })),
        addListener: vi.fn(async (_event, listener) => {
          opened = listener;
          return { remove };
        }),
      },
      navigate,
    });

    expect(navigate).toHaveBeenCalledWith("/orders/cold-order");
    opened?.({ url: "coffeebar://messages/warm-message" });
    expect(navigate).toHaveBeenLastCalledWith("/messages/warm-message");
    opened?.({ url: "https://evil.example/orders/nope" });
    expect(navigate).toHaveBeenCalledTimes(2);

    await dispose();
    expect(remove).toHaveBeenCalledOnce();
  });
});
