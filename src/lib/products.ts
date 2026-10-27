import "server-only";
import { unstable_cache } from "next/cache";
import { dbGetProduct, dbListProducts } from "./db";

/**
 * Cached readers (the "Data Cache" layer) used by the ISR pages.
 *
 * Two caches are involved in ISR:
 *   1. Full Route Cache: the rendered page. Controlled by `export const revalidate` in the page.
 *   2. Data Cache: results of data reads (unstable_cache here). Controlled by `revalidate` + `tags`.
 * The `revalidate` values below match the page windows on purpose: if the page regenerates
 * but the Data Cache still holds old data, you regenerate the same stale page.
 *
 * `loadedAt` is created INSIDE the cached function, so it shows when the DB was really read.
 *
 * (With Cache Components enabled, `unstable_cache` is replaced by the "use cache" directive.)
 */

export const getProducts = unstable_cache(
  async () => {
    const items = await dbListProducts();
    return { items, loadedAt: new Date().toISOString() };
  },
  ["shop:products:list"],
  { tags: ["products"], revalidate: 30 },
);

export function getProduct(id: string) {
  return unstable_cache(
    async () => {
      const product = await dbGetProduct(id);
      return { product, loadedAt: new Date().toISOString() };
    },
    ["shop:products:item", id],
    { tags: [`product-${id}`], revalidate: 60 },
  )();
}
