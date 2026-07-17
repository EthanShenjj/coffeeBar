import { cartLineSchema, type CartKind, type CartLine, type ProductView } from "@coffeebar/contracts";
import { z } from "zod";
import { createStore } from "zustand/vanilla";

const VERSION = 1;
const persistedCartSchema = z.object({
  version: z.literal(VERSION),
  kind: z.enum(["MENU", "SHOP"]),
  items: z.array(cartLineSchema).max(100),
}).strict();

export function restoreCartState(raw: string | null, kind: CartKind): { items: CartLine[] } {
  if (!raw) return { items: [] };
  try {
    const parsed = persistedCartSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.kind !== kind || parsed.data.items.some((line) => line.product.channel !== kind)) return { items: [] };
    return { items: parsed.data.items };
  } catch {
    return { items: [] };
  }
}

type CartState = {
  kind: CartKind;
  items: CartLine[];
  addItem(product: ProductView, optionIds: string[], quantity?: number): string;
  buyNow(product: ProductView, optionIds: string[], quantity?: number): string;
  setQuantity(lineId: string, quantity: number): void;
  removeItem(lineId: string): void;
  clear(): void;
  totalCents(): number;
};

type CartStoreOptions = { storage: Pick<Storage, "getItem" | "setItem"> };

function normalizedOptions(optionIds: string[]) {
  return [...new Set(optionIds)].sort();
}

function makeLineId(productId: string, optionIds: string[]) {
  return `${productId}:${optionIds.join(",")}`;
}

function lineUnitPrice(line: CartLine) {
  const options = line.product.optionGroups.flatMap((group) => group.options);
  return line.product.price + line.optionIds.reduce((sum, id) => sum + (options.find((option) => option.id === id)?.priceDelta ?? 0), 0);
}

export function createCartStore(kind: CartKind, options: CartStoreOptions) {
  const key = `coffeebar.cart.${kind}`;
  const initial = restoreCartState(options.storage.getItem(key), kind);
  const store = createStore<CartState>((set, get) => ({
    kind,
    items: initial.items,
    addItem(product, inputOptionIds, inputQuantity = 1) {
      if (product.channel !== kind || !Number.isInteger(inputQuantity) || inputQuantity < 1) throw new Error("商品与购物车不匹配");
      const optionIds = normalizedOptions(inputOptionIds);
      const lineId = makeLineId(product.id, optionIds);
      set((state) => {
        const existing = state.items.find((line) => line.lineId === lineId);
        return { items: existing
          ? state.items.map((line) => line.lineId === lineId ? { ...line, quantity: line.quantity + inputQuantity } : line)
          : [...state.items, { lineId, product, quantity: inputQuantity, optionIds }] };
      });
      return lineId;
    },
    buyNow(product, inputOptionIds, quantity = 1) {
      if (product.channel !== kind || !Number.isInteger(quantity) || quantity < 1) throw new Error("商品与购物车不匹配");
      const optionIds = normalizedOptions(inputOptionIds);
      const lineId = makeLineId(product.id, optionIds);
      set({ items: [{ lineId, product, quantity, optionIds }] });
      return lineId;
    },
    setQuantity(lineId, quantity) {
      if (!Number.isInteger(quantity)) return;
      set((state) => ({ items: quantity < 1 ? state.items.filter((line) => line.lineId !== lineId) : state.items.map((line) => line.lineId === lineId ? { ...line, quantity } : line) }));
    },
    removeItem: (lineId) => set((state) => ({ items: state.items.filter((line) => line.lineId !== lineId) })),
    clear: () => set({ items: [] }),
    totalCents: () => get().items.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0),
  }));
  store.subscribe((state) => {
    options.storage.setItem(key, JSON.stringify({ version: VERSION, kind, items: state.items }));
  });
  return store;
}

export type CartStore = ReturnType<typeof createCartStore>;
