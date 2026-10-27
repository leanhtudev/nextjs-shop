"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CheckoutSchema } from "@/lib/checkout-schema";
import { dbCreateOrder } from "@/lib/db";
import { eur } from "@/lib/format";
import { createContext } from "@/server/context";

/**
 * SERVER ACTION: the checkout.
 *
 * Why a Server Action here and tRPC for the cart?
 *  - Checkout is a FORM submit: Server Actions work without client JavaScript
 *    (progressive enhancement), integrate with redirect(), and can call updateTag().
 *  - The cart is interactive state in client components: tRPC + React Query give typed
 *    calls, optimistic updates, caching and refetching.
 * Both are thin transport layers; the rules live in shared code (db, pricing, schema).
 *
 * Like every Server Action this is a PUBLIC POST endpoint, so it follows the recipe:
 *   1. validate input (zod)            4. mutate all-or-nothing (stock + order)
 *   2. never trust client money        5. invalidate caches (updateTag)
 *   3. idempotency (double submit)     6. redirect to a result page
 */

export type CheckoutState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echoed back so the inputs keep what the user typed (React resets uncontrolled forms after an action). */
  values?: Record<string, string>;
};

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;

  // 1) Validation. Prices and totals are not accepted from the client at all.
  const parsed = CheckoutSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }
  const { idempotencyKey, ...customer } = parsed.data;

  // 2) The cart cookie supplies ids and quantities only.
  const ctx = createContext();
  const cart = await ctx.cart.read();
  const items = Object.entries(cart).map(([productId, qty]) => ({ productId, qty }));

  // 3 + 4) Idempotency, stock check, stock decrement and order creation, all or nothing.
  const result = await dbCreateOrder({ items, customer, idempotencyKey });
  if (!result.ok) {
    if (result.reason === "EMPTY_CART") return { ok: false, message: "Your cart is empty.", values };
    const detail = result.shortages
      .map((s) => `${s.name}: you asked for ${s.requested}, only ${s.available} left`)
      .join("; ");
    return { ok: false, message: `Not enough stock. ${detail}. Update your cart and try again.`, values };
  }

  const { order } = result;
  await ctx.orders.remember(order.id); // this browser may now read the order
  await ctx.cart.write({});

  // 5) Stock changed, so the cached product pages are wrong. updateTag() expires them NOW
  //    (read-your-own-writes): the next visit waits for fresh data instead of seeing old stock.
  //    Server Actions only. A Route Handler would use revalidateTag(tag, "max").
  for (const line of order.lines) updateTag(`product-${line.productId}`);
  updateTag("products");

  console.log(`[checkout] order ${order.id} ${eur(order.totalCents)} replayed=${result.replayed}`);

  // 6) redirect() throws a control-flow exception: nothing after it runs.
  redirect(`/orders/${order.id}`);
}
