"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartKind, CartLine, ProductView } from "@/lib/types";

type CartState = {
  menu: CartLine[];
  shop: CartLine[];
  add: (product: ProductView, optionIds: string[], quantity?: number) => void;
  update: (kind: CartKind, lineId: string, quantity: number) => void;
  remove: (kind: CartKind, lineId: string) => void;
  clear: (kind: CartKind) => void;
};

const key = (kind: CartKind) => (kind === "MENU" ? "menu" : "shop");

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      menu: [],
      shop: [],
      add: (product, optionIds, quantity = 1) => set((state) => {
        const cartKey = key(product.channel);
        const sorted = [...optionIds].sort();
        const lineId = `${product.id}:${sorted.join(",")}`;
        const lines = state[cartKey];
        const existing = lines.find((line) => line.lineId === lineId);
        return {
          [cartKey]: existing
            ? lines.map((line) => line.lineId === lineId ? { ...line, quantity: line.quantity + quantity } : line)
            : [...lines, { lineId, product, optionIds: sorted, quantity }],
        } as Pick<CartState, typeof cartKey>;
      }),
      update: (kind, lineId, quantity) => set((state) => {
        const cartKey = key(kind);
        return { [cartKey]: state[cartKey].map((line) => line.lineId === lineId ? { ...line, quantity: Math.max(1, quantity) } : line) } as Pick<CartState, typeof cartKey>;
      }),
      remove: (kind, lineId) => set((state) => {
        const cartKey = key(kind);
        return { [cartKey]: state[cartKey].filter((line) => line.lineId !== lineId) } as Pick<CartState, typeof cartKey>;
      }),
      clear: (kind) => set({ [key(kind)]: [] }),
    }),
    { name: "coffeebar-carts" },
  ),
);

export function lineTotal(line: CartLine) {
  const delta = line.product.optionGroups
    .flatMap((group) => group.options)
    .filter((option) => line.optionIds.includes(option.id))
    .reduce((sum, option) => sum + option.priceDelta, 0);
  return (line.product.price + delta) * line.quantity;
}
