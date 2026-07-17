import type { ProductView } from "@coffeebar/contracts";
import { createCartStore, restoreCartState } from "./cart-store";

const coffee: ProductView = {
  id: "coffee-1", slug: "latte", name: "Latte", subtitle: "", description: "", channel: "MENU",
  category: "Coffee", price: 3200, imageUrl: "", stock: null, isAvailable: true, optionGroups: [],
};
const mug: ProductView = { ...coffee, id: "mug-1", slug: "mug", name: "Mug", channel: "SHOP", price: 8000 };

describe("persisted dual carts", () => {
  it("keeps MENU and SHOP carts isolated and uses integer cents", () => {
    const menu = createCartStore("MENU", { storage: window.localStorage });
    const shop = createCartStore("SHOP", { storage: window.localStorage });
    menu.getState().addItem(coffee, ["hot"]);
    shop.getState().addItem(mug, []);
    menu.getState().setQuantity(menu.getState().items[0]!.lineId, 2);

    expect(menu.getState().items).toHaveLength(1);
    expect(shop.getState().items).toHaveLength(1);
    expect(menu.getState().totalCents()).toBe(6400);
    expect(shop.getState().totalCents()).toBe(8000);
  });

  it("restores valid data, rejects wrong-channel and malformed persisted data", () => {
    const valid = JSON.stringify({ version: 1, kind: "MENU", items: [{ lineId: "line", product: coffee, quantity: 2, optionIds: [] }] });
    expect(restoreCartState(valid, "MENU").items).toHaveLength(1);
    expect(restoreCartState(valid, "SHOP").items).toEqual([]);
    expect(restoreCartState('{"version":99}', "MENU").items).toEqual([]);
    expect(restoreCartState("not-json", "MENU").items).toEqual([]);
  });

  it("survives authentication and network changes", () => {
    const menu = createCartStore("MENU", { storage: window.localStorage });
    menu.getState().addItem(coffee, []);
    window.dispatchEvent(new Event("offline"));
    window.sessionStorage.setItem("coffeebar.session-token", "token");
    window.sessionStorage.removeItem("coffeebar.session-token");
    expect(menu.getState().items).toHaveLength(1);
  });

  it("supports direct-buy replacement without mutating the other cart", () => {
    const menu = createCartStore("MENU", { storage: window.localStorage });
    const shop = createCartStore("SHOP", { storage: window.localStorage });
    shop.getState().addItem(mug, []);
    const lineId = menu.getState().buyNow(coffee, [], 3);
    expect(menu.getState().items).toEqual([expect.objectContaining({ lineId, quantity: 3 })]);
    expect(shop.getState().items).toHaveLength(1);
  });
});
