import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dbGetProduct } from "@/lib/db";
import { MAX_QTY_PER_LINE, summarize, type CartLine, type CartSummary } from "@/lib/pricing";
import type { Context } from "../context";
import { mutationProcedure, publicProcedure, router } from "../trpc";

const countOf = (cart: Record<string, number>) => Object.values(cart).reduce((sum, qty) => sum + qty, 0);

/** Cart cookie (ids + quantities) joined with LIVE prices and stock from the database. */
async function loadSummary(ctx: Context): Promise<CartSummary> {
  const cart = await ctx.cart.read();
  const entries = Object.entries(cart);
  const products = await Promise.all(entries.map(([id]) => dbGetProduct(id)));
  const lines: CartLine[] = [];
  entries.forEach(([productId, qty], i) => {
    const product = products[i];
    if (!product) return; // product was removed from the catalogue: drop the line
    lines.push({ productId, name: product.name, unitPriceCents: product.priceCents, qty, stock: product.stock });
  });
  return summarize(lines);
}

const ProductId = z.string().min(1).max(20);

export const cartRouter = router({
  /** Full cart with live prices. Used by the SSR cart page and the client cart. */
  get: publicProcedure.query(({ ctx }) => loadSummary(ctx)),

  /** Cheap: cookie only, no database. Powers the number in the header. */
  count: publicProcedure.query(async ({ ctx }) => ({ count: countOf(await ctx.cart.read()) })),

  add: mutationProcedure
    .input(z.object({ productId: ProductId, qty: z.number().int().min(1).max(MAX_QTY_PER_LINE) }))
    .mutation(async ({ ctx, input }) => {
      const cart = await ctx.cart.read();
      const product = await dbGetProduct(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      const inCart = cart[input.productId] ?? 0;
      const next = inCart + input.qty;
      if (next > MAX_QTY_PER_LINE) {
        throw new TRPCError({ code: "CONFLICT", message: `You can order at most ${MAX_QTY_PER_LINE} of one product.` });
      }
      // Re-check against the database: the product page may show stale stock (ISR).
      if (next > product.stock) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Only ${product.stock} in stock${inCart > 0 ? ` (you already have ${inCart} in your cart)` : ""}.`,
        });
      }
      const updated = { ...cart, [input.productId]: next };
      await ctx.cart.write(updated);
      return { count: countOf(updated) };
    }),

  /** Set an exact quantity. 0 removes the line. */
  setQty: mutationProcedure
    .input(z.object({ productId: ProductId, qty: z.number().int().min(0).max(MAX_QTY_PER_LINE) }))
    .mutation(async ({ ctx, input }) => {
      const cart = { ...(await ctx.cart.read()) };
      if (input.qty === 0) {
        delete cart[input.productId];
      } else {
        const product = await dbGetProduct(input.productId);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        if (input.qty > product.stock) {
          throw new TRPCError({ code: "CONFLICT", message: `Only ${product.stock} in stock.` });
        }
        cart[input.productId] = input.qty;
      }
      await ctx.cart.write(cart);
      return { count: countOf(cart) };
    }),

  clear: mutationProcedure.mutation(async ({ ctx }) => {
    await ctx.cart.write({});
    return { count: 0 };
  }),
});
