import { CHECKOUT_MAX_ITEM_LINES, cartLineSchema, type CartKind, type CartLine, type ProductView } from "@coffeebar/contracts";
import { z } from "zod";
import { createStore } from "zustand/vanilla";

const VERSION = 1;
const MAX_CART_LINES = CHECKOUT_MAX_ITEM_LINES;
const MAX_LINE_QUANTITY = 20;
const persistedCartSchema = z.object({
  version: z.literal(VERSION),
  kind: z.enum(["MENU", "SHOP"]),
  items: z.array(z.unknown()),
}).strict();

function normalizeOptions(product: ProductView, inputOptionIds: string[]) {
  const optionIds = [...new Set(inputOptionIds)].sort();
  const optionGroupsByOption = new Map<string, (typeof product.optionGroups)[number]>();
  for (const group of product.optionGroups) {
    for (const option of group.options) {
      if (optionGroupsByOption.has(option.id)) throw new Error(`规格 ID 重复：${option.id}`);
      optionGroupsByOption.set(option.id, group);
    }
  }
  for (const optionId of optionIds) {
    if (!optionGroupsByOption.has(optionId)) throw new Error("包含未知规格");
  }
  for (const group of product.optionGroups) {
    const selected = optionIds.filter((optionId) => group.options.some((option) => option.id === optionId));
    if (group.required && selected.length === 0) throw new Error(`请选择必选规格：${group.name}`);
    if (selected.length > group.maxSelect) throw new Error(`规格数量超过上限：${group.name}`);
  }
  return optionIds;
}

function makeLineId(productId: string, optionIds: string[]) {
  return `${encodeURIComponent(productId)}:${optionIds.map((id) => encodeURIComponent(id)).join(",")}`;
}

function createLine(product: ProductView, inputOptionIds: string[], quantity: number): CartLine {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) throw new Error("商品数量必须在 1 到 20 之间");
  const optionIds = normalizeOptions(product, inputOptionIds);
  return { lineId: makeLineId(product.id, optionIds), product, quantity, optionIds };
}

export function restoreCartState(raw: string | null, kind: CartKind): { items: CartLine[] } {
  if (!raw) return { items: [] };
  try {
    const parsed = persistedCartSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.kind !== kind) return { items: [] };
    const items: CartLine[] = [];
    for (const candidate of parsed.data.items) {
      if (items.length >= MAX_CART_LINES) break;
      const line = cartLineSchema.safeParse(candidate);
      if (!line.success || line.data.product.channel !== kind) continue;
      try {
        const normalized = createLine(line.data.product, line.data.optionIds, line.data.quantity);
        const existingIndex = items.findIndex((item) => item.lineId === normalized.lineId);
        if (existingIndex >= 0) {
          const existing = items[existingIndex]!;
          const combinedQuantity = existing.quantity + normalized.quantity;
          if (combinedQuantity <= MAX_LINE_QUANTITY) items[existingIndex] = { ...existing, quantity: combinedQuantity };
          continue;
        }
        items.push(normalized);
      } catch {
        // Drop only the corrupted line and retain the rest of the local cart.
      }
    }
    return { items };
  } catch {
    return { items: [] };
  }
}

type CartState = {
  kind: CartKind;
  items: CartLine[];
  addItem(product: ProductView, optionIds: string[], quantity?: number): string;
  buyNow(product: ProductView, optionIds: string[], quantity?: number): CartLine;
  setQuantity(lineId: string, quantity: number): void;
  removeItem(lineId: string): void;
  clear(): void;
  totalCents(): number;
};

type CartStoreOptions = { storage: Pick<Storage, "getItem" | "setItem"> };

function lineUnitPrice(line: CartLine) {
  const options = line.product.optionGroups.flatMap((group) => group.options);
  const value = line.product.price + line.optionIds.reduce((sum, id) => sum + options.find((option) => option.id === id)!.priceDelta, 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("商品金额无效");
  return value;
}

export function createCartStore(kind: CartKind, options: CartStoreOptions) {
  const key = `coffeebar.cart.${kind}`;
  let initialRaw: string | null = null;
  try { initialRaw = options.storage.getItem(key); } catch { /* Treat unavailable storage as an empty cart. */ }
  const initial = restoreCartState(initialRaw, kind);
  const store = createStore<CartState>((set, get) => ({
    kind,
    items: initial.items,
    addItem(product, inputOptionIds, inputQuantity = 1) {
      if (product.channel !== kind) throw new Error("商品与购物车不匹配");
      const nextLine = createLine(product, inputOptionIds, inputQuantity);
      const existing = get().items.find((line) => line.lineId === nextLine.lineId);
      if (existing && existing.quantity + inputQuantity > MAX_LINE_QUANTITY) throw new Error("商品数量超过上限");
      if (!existing && get().items.length >= MAX_CART_LINES) throw new Error("购物车商品种类已达上限");
      set((state) => ({ items: existing
        ? state.items.map((line) => line.lineId === nextLine.lineId ? { ...line, quantity: line.quantity + inputQuantity } : line)
        : [...state.items, nextLine] }));
      return nextLine.lineId;
    },
    buyNow(product, inputOptionIds, quantity = 1) {
      if (product.channel !== kind) throw new Error("商品与购物车不匹配");
      return createLine(product, inputOptionIds, quantity);
    },
    setQuantity(lineId, quantity) {
      if (!Number.isInteger(quantity) || quantity > MAX_LINE_QUANTITY) throw new Error("商品数量必须在 0 到 20 之间");
      set((state) => ({ items: quantity < 1 ? state.items.filter((line) => line.lineId !== lineId) : state.items.map((line) => line.lineId === lineId ? { ...line, quantity } : line) }));
    },
    removeItem: (lineId) => set((state) => ({ items: state.items.filter((line) => line.lineId !== lineId) })),
    clear: () => set({ items: [] }),
    totalCents: () => get().items.reduce((sum, line) => {
      const lineTotal = lineUnitPrice(line) * line.quantity;
      const total = sum + lineTotal;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total)) throw new Error("购物车金额超出可用范围");
      return total;
    }, 0),
  }));
  store.subscribe((state) => {
    try {
      options.storage.setItem(key, JSON.stringify({ version: VERSION, kind, items: state.items }));
    } catch {
      // Cart stays usable in memory when persistence is unavailable.
    }
  });
  return store;
}

export type CartStore = ReturnType<typeof createCartStore>;
