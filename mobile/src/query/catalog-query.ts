import { productViewSchema, type CartKind } from "@coffeebar/contracts";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { ApiClient } from "../lib/api-client";
import type { CatalogCache } from "./catalog-cache";

const catalogSchema = z.array(productViewSchema);
export const catalogQueryKey = (channel: CartKind) => ["catalog", channel] as const;

export function catalogQueryOptions(input: { channel: CartKind; api: ApiClient; cache: CatalogCache }) {
  return queryOptions({
    queryKey: catalogQueryKey(input.channel),
    queryFn: async () => {
      const products = await input.api.get(`/api/v1/catalog?channel=${input.channel}`, { schema: catalogSchema, authenticated: false });
      await input.cache.persist(input.channel, products);
      return products;
    },
    staleTime: 5 * 60_000,
  });
}

export async function restoreCatalogQueries(queryClient: QueryClient, cache: CatalogCache) {
  await Promise.all((["MENU", "SHOP"] as const).map(async (channel) => {
    const entry = await cache.restore(channel);
    if (entry?.products.length) queryClient.setQueryData(catalogQueryKey(channel), entry.products, { updatedAt: entry.updatedAt });
  }));
}
