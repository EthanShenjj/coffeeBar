import { unstable_cache } from "next/cache";
import { PRODUCT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { DEMO_PRODUCTS } from "@/lib/demo-data";
import { getDb, hasDatabase } from "@/lib/db";
import type { CartKind, ProductView } from "@/lib/types";

async function loadProductCatalog(): Promise<ProductView[]> {
  const products = await getDb().product.findMany({
    where: { isAvailable: true },
    orderBy: [{ channel: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: { optionGroups: { orderBy: { sortOrder: "asc" }, include: { options: { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } } } } },
  });

  return products.map((product) => {
    const menuMeta = DEMO_PRODUCTS.find((item) => item.slug === product.slug);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      subtitle: product.subtitle ?? "",
      description: product.description,
      channel: product.channel,
      category: product.category,
      menuCollection: menuMeta?.menuCollection ?? "CLASSIC",
      menuSection: menuMeta?.menuSection ?? product.category,
      price: product.basePrice,
      imageUrl: product.imageUrl,
      stock: product.stock,
      isAvailable: product.isAvailable,
      optionGroups: product.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        required: group.isRequired,
        maxSelect: group.maxSelect,
        options: group.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceDelta: option.priceDelta,
          isDefault: option.isDefault,
        })),
      })),
    };
  });
}

const getCachedProductCatalog = unstable_cache(
  loadProductCatalog,
  ["coffeebar-product-catalog-v1"],
  { revalidate: 5 * 60, tags: [PRODUCT_CATALOG_CACHE_TAG] },
);

export async function getProducts(channel: CartKind): Promise<ProductView[]> {
  const catalog = hasDatabase() ? await getCachedProductCatalog() : DEMO_PRODUCTS;
  return catalog.filter((item) => item.channel === channel);
}
