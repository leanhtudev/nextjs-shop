import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dbGetOrder } from "@/lib/db";
import { publicProcedure, router } from "../trpc";

/**
 * Authorization as MIDDLEWARE: this procedure base only lets a caller read an order
 * that THIS browser placed (its id is in the HttpOnly orders cookie).
 *
 * Without this check anyone who guesses or leaks an id could read someone else's
 * address and email. That is "broken access control" (OWASP #1) in its classic form (IDOR).
 *
 * It answers NOT_FOUND, not FORBIDDEN, so an attacker cannot tell "exists but not yours"
 * from "does not exist".
 */
const ownedOrderProcedure = publicProcedure
  .input(z.object({ id: z.string().regex(/^ord_[0-9a-f]{12}$/, "Invalid order id") }))
  .use(async ({ ctx, input, next }) => {
    const ownIds = await ctx.orders.ids();
    if (!ownIds.includes(input.id)) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    return next();
  });

export const orderRouter = router({
  byId: ownedOrderProcedure.query(async ({ input }) => {
    const order = await dbGetOrder(input.id);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    return order;
  }),
});
