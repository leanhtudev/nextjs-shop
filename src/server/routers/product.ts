import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dbGetProduct } from "@/lib/db";
import { getProduct, getProducts } from "@/lib/products";
import { publicProcedure, router } from "../trpc";

const IdInput = z.object({ id: z.string().min(1).max(20) });

export const productRouter = router({
  /** CACHED (Data Cache, tag "products"). Used by the ISR list page. */
  list: publicProcedure.query(() => getProducts()),

  /** CACHED (Data Cache, tag "product-<id>"). Used by the ISR product page. */
  byId: publicProcedure.input(IdInput).query(async ({ input }) => {
    const result = await getProduct(input.id);
    if (!result.product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    return { product: result.product, loadedAt: result.loadedAt };
  }),

  /**
   * LIVE (not cached): the real stock and price right now.
   * The ISR page can be up to 60 s old, so a small client component asks this
   * procedure to show the truth next to the cached page.
   */
  liveStock: publicProcedure.input(IdInput).query(async ({ input }) => {
    const product = await dbGetProduct(input.id);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    return { stock: product.stock, priceCents: product.priceCents, checkedAt: new Date().toISOString() };
  }),

  /** Search-as-you-type. Input is validated: empty or huge strings never reach the code below. */
  search: publicProcedure
    .input(z.object({ q: z.string().trim().min(1).max(50) }))
    .query(async ({ input }) => {
      const { items } = await getProducts();
      const q = input.q.toLowerCase();
      return items.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
    }),
});
