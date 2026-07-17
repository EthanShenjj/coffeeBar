import type { ProductView } from "@coffeebar/contracts";
import { createCartStore, restoreCartState } from "./cart-store";

const coffee: ProductView = {
  id: "coffee-1", slug: "latte", name: "Latte", subtitle: "", description: "", channel: "MENU",
  category: "Coffee", price: 3200, imageUrl: "", stock: null, isAvailable: true, optionGroups: [{
    id: "temperature", name: "Temperature", required: true, maxSelect: 1,
    options: [{ id: "hot", name: "Hot", priceDelta: 0 }, { id: "iced", name: "Iced", priceDelta: 300 }],
  }],
};
const mug: ProductView = { ...coffee, id: "mug-1", slug: "mug", name: "Mug", channel: "SHOP", price: 8000, optionGroups: [] };

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
    const valid = JSON.stringify({ version: 1, kind: "MENU", items: [{ lineId: "wrong", product: coffee, quantity: 2, optionIds: ["hot", "hot"] }] });
    const restored = restoreCartState(valid, "MENU").items;
    expect(restored).toEqual([expect.objectContaining({ lineId: "coffee-1:hot", optionIds: ["hot"] })]);
    expect(restoreCartState(valid, "SHOP").items).toEqual([]);
    expect(restoreCartState('{"version":99}', "MENU").items).toEqual([]);
    expect(restoreCartState("not-json", "MENU").items).toEqual([]);
  });

  it("survives authentication and network changes", () => {
    const menu = createCartStore("MENU", { storage: window.localStorage });
    menu.getState().addItem(coffee, ["hot"]);
    window.dispatchEvent(new Event("offline"));
    window.sessionStorage.setItem("coffeebar.session-token", "token");
    window.sessionStorage.removeItem("coffeebar.session-token");
    expect(menu.getState().items).toHaveLength(1);
  });

  it("creates a direct purchase without clearing either persisted cart", () => {
    const menu = createCartStore("MENU", { storage: window.localStorage });
    const shop = createCartStore("SHOP", { storage: window.localStorage });
    menu.getState().addItem(coffee, ["hot"]);
    shop.getState().addItem(mug, []);
    const direct = menu.getState().buyNow(coffee, ["iced"], 3);
    expect(direct).toEqual(expect.objectContaining({ lineId: "coffee-1:iced", quantity: 3 }));
    expect(menu.getState().items).toEqual([expect.objectContaining({ lineId: "coffee-1:hot" })]);
    expect(shop.getState().items).toHaveLength(1);
  });

  it("rejects unknown, missing required, and over-selected options", () => {
    const menu = createCartStore("MENU", { storage: window.localStorage });
    expect(() => menu.getState().addItem(coffee, [])).toThrow("必选规格");
    expect(() => menu.getState().addItem(coffee, ["unknown"])).toThrow("未知规格");
    expect(() => menu.getState().addItem(coffee, ["hot", "iced"])).toThrow("规格数量");
  });

  it("normalizes duplicates once and enforces quantity and line limits before persistence", () => {
    const menu = createCartStore("MENU", { storage: window.localStorage });
    menu.getState().addItem(coffee, ["hot", "hot"]);
    expect(menu.getState().items[0]?.optionIds).toEqual(["hot"]);
    expect(menu.getState().totalCents()).toBe(3200);
    expect(() => menu.getState().addItem(coffee, ["hot"], 20)).toThrow("数量");

    for (let index = 0; index < 29; index += 1) {
      menu.getState().addItem({ ...coffee, id: `coffee-${index + 2}` }, ["hot"]);
    }
    expect(menu.getState().items).toHaveLength(30);
    expect(() => menu.getState().addItem({ ...coffee, id: "overflow" }, ["hot"])).toThrow("上限");
    expect(restoreCartState(window.localStorage.getItem("coffeebar.cart.MENU"), "MENU").items).toHaveLength(30);
  });

  it("drops irreparable polluted hydrate lines without dropping the valid cart", () => {
    const raw = JSON.stringify({ version: 1, kind: "MENU", items: [
      { lineId: "valid", product: coffee, quantity: 1, optionIds: ["hot"] },
      { lineId: "bad", product: coffee, quantity: 1, optionIds: ["unknown"] },
      { lineId: "too-many", product: coffee, quantity: 21, optionIds: ["hot"] },
    ] });
    expect(restoreCartState(raw, "MENU").items).toEqual([expect.objectContaining({ lineId: "coffee-1:hot" })]);
  });

  it("merges canonical duplicate hydrate lines without duplicate checkout keys", () => {
    const raw = JSON.stringify({ version: 1, kind: "MENU", items: [
      { lineId: "first", product: coffee, quantity: 2, optionIds: ["hot"] },
      { lineId: "second", product: coffee, quantity: 3, optionIds: ["hot", "hot"] },
      { lineId: "overflow", product: coffee, quantity: 20, optionIds: ["hot"] },
    ] });
    expect(restoreCartState(raw, "MENU").items).toEqual([
      expect.objectContaining({ lineId: "coffee-1:hot", quantity: 5, optionIds: ["hot"] }),
    ]);
  });

  it("rejects product option IDs duplicated across groups at add and hydrate boundaries", () => {
    const ambiguous: ProductView = { ...coffee, optionGroups: [
      ...coffee.optionGroups,
      { id: "duplicate", name: "Duplicate", required: false, maxSelect: 1, options: [{ id: "hot", name: "Again", priceDelta: 100 }] },
    ] };
    const menu = createCartStore("MENU", { storage: window.localStorage });
    expect(() => menu.getState().addItem(ambiguous, ["hot"])).toThrow("重复");
    const raw = JSON.stringify({ version: 1, kind: "MENU", items: [{ lineId: "bad", product: ambiguous, quantity: 1, optionIds: ["hot"] }] });
    expect(restoreCartState(raw, "MENU").items).toEqual([]);
  });
});
