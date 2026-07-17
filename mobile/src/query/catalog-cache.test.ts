import type { ProductView } from "@coffeebar/contracts";
import { createCatalogCache } from "./catalog-cache";

const product: ProductView = {
  id: "1", slug: "latte", name: "Latte", subtitle: "", description: "", channel: "MENU", category: "Coffee",
  price: 3200, imageUrl: "", stock: null, isAvailable: true, optionGroups: [],
};

describe("catalog offline cache", () => {
  it("persists and restores only validated public catalog data", async () => {
    const cache = createCatalogCache(window.localStorage);
    await cache.persist("MENU", [product]);
    expect(await cache.restore("MENU")).toEqual([product]);
    expect(window.localStorage.getItem("coffeebar.catalog.MENU")).not.toContain("session");
  });

  it("discards corrupt or mismatched cache data", async () => {
    window.localStorage.setItem("coffeebar.catalog.MENU", JSON.stringify({ version: 1, channel: "SHOP", products: [product] }));
    expect(await createCatalogCache(window.localStorage).restore("MENU")).toEqual([]);
  });
});
