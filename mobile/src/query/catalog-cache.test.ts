import type { ProductView } from "@coffeebar/contracts";
import { QueryClient } from "@tanstack/react-query";
import { createCatalogCache } from "./catalog-cache";
import { catalogQueryKey, restoreCatalogQueries } from "./catalog-query";

const product: ProductView = {
  id: "1", slug: "latte", name: "Latte", subtitle: "", description: "", channel: "MENU", category: "Coffee",
  price: 3200, imageUrl: "", stock: null, isAvailable: true, optionGroups: [],
};

describe("catalog offline cache", () => {
  it("persists and restores only validated public catalog data", async () => {
    const cache = createCatalogCache(window.localStorage, { now: () => 10_000, ttlMs: 60_000 });
    await cache.persist("MENU", [product]);
    expect(await cache.restore("MENU")).toEqual({ products: [product], updatedAt: 10_000 });
    expect(window.localStorage.getItem("coffeebar.catalog.MENU")).not.toContain("session");
  });

  it("discards corrupt or mismatched cache data", async () => {
    window.localStorage.setItem("coffeebar.catalog.MENU", JSON.stringify({ version: 1, channel: "SHOP", products: [product] }));
    expect(await createCatalogCache(window.localStorage).restore("MENU")).toBeNull();
  });

  it("treats storage security and quota errors as cache misses without failing requests", async () => {
    const throwingStorage = {
      getItem: vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }),
      setItem: vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); }),
      removeItem: vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }),
    };
    const cache = createCatalogCache(throwingStorage);
    await expect(cache.persist("MENU", [product])).resolves.toBeUndefined();
    await expect(cache.restore("MENU")).resolves.toBeNull();
  });

  it("expires old entries and retains original freshness time", async () => {
    const cache = createCatalogCache(window.localStorage, { now: () => 100_000, ttlMs: 1_000 });
    window.localStorage.setItem("coffeebar.catalog.MENU", JSON.stringify({ version: 2, channel: "MENU", products: [product], updatedAt: 98_000 }));
    expect(await cache.restore("MENU")).toBeNull();
  });

  it("hydrates TanStack Query with the original fetch time", async () => {
    const cache = createCatalogCache(window.localStorage, { now: () => 10_000, ttlMs: 60_000 });
    await cache.persist("MENU", [product]);
    const queryClient = new QueryClient();
    await restoreCatalogQueries(queryClient, cache);
    expect(queryClient.getQueryState(catalogQueryKey("MENU"))?.dataUpdatedAt).toBe(10_000);
  });
});
