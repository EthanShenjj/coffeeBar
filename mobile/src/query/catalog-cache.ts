import { cartKindSchema, productViewSchema, type CartKind, type ProductView } from "@coffeebar/contracts";
import { z } from "zod";

const DEFAULT_TTL_MS = 24 * 60 * 60_000;
const catalogCacheSchema = z.object({
  version: z.literal(2),
  channel: cartKindSchema,
  products: z.array(productViewSchema),
  updatedAt: z.number().int().nonnegative(),
}).strict();

type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type CatalogCacheEntry = { products: ProductView[]; updatedAt: number };

export function createCatalogCache(
  storage: CacheStorage,
  options: { now?: () => number; ttlMs?: number } = {},
) {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const key = (channel: CartKind) => `coffeebar.catalog.${channel}`;
  const removeBestEffort = (channel: CartKind) => {
    try { storage.removeItem(key(channel)); } catch { /* Cache removal is best effort. */ }
  };
  return {
    async persist(channel: CartKind, products: ProductView[]) {
      const value = catalogCacheSchema.parse({ version: 2, channel, products, updatedAt: now() });
      try { storage.setItem(key(channel), JSON.stringify(value)); } catch { /* A successful API request must not fail on cache quota. */ }
    },
    async restore(channel: CartKind): Promise<CatalogCacheEntry | null> {
      let raw: string | null;
      try { raw = storage.getItem(key(channel)); } catch { return null; }
      if (!raw) return null;
      try {
        const value = catalogCacheSchema.safeParse(JSON.parse(raw));
        if (!value.success || value.data.channel !== channel || value.data.products.some((product) => product.channel !== channel)) {
          removeBestEffort(channel);
          return null;
        }
        if (now() - value.data.updatedAt > ttlMs || value.data.updatedAt > now() + 60_000) {
          removeBestEffort(channel);
          return null;
        }
        return { products: value.data.products, updatedAt: value.data.updatedAt };
      } catch {
        removeBestEffort(channel);
        return null;
      }
    },
  };
}

export type CatalogCache = ReturnType<typeof createCatalogCache>;
