import { cartKindSchema, productViewSchema, type CartKind, type ProductView } from "@coffeebar/contracts";
import { z } from "zod";

const catalogCacheSchema = z.object({
  version: z.literal(1),
  channel: cartKindSchema,
  products: z.array(productViewSchema),
}).strict();

type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createCatalogCache(storage: CacheStorage) {
  const key = (channel: CartKind) => `coffeebar.catalog.${channel}`;
  return {
    async persist(channel: CartKind, products: ProductView[]) {
      const value = catalogCacheSchema.parse({ version: 1, channel, products });
      storage.setItem(key(channel), JSON.stringify(value));
    },
    async restore(channel: CartKind) {
      const raw = storage.getItem(key(channel));
      if (!raw) return [];
      try {
        const value = catalogCacheSchema.safeParse(JSON.parse(raw));
        if (!value.success || value.data.channel !== channel || value.data.products.some((product) => product.channel !== channel)) {
          storage.removeItem(key(channel));
          return [];
        }
        return value.data.products;
      } catch {
        storage.removeItem(key(channel));
        return [];
      }
    },
  };
}

export type CatalogCache = ReturnType<typeof createCatalogCache>;
