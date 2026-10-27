"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

/**
 * The number next to "Cart" in the header.
 *
 * It is a client component on purpose: the root layout must NOT read cookies, or every
 * page under it becomes SSR and ISR silently stops working. The layout stays static;
 * this small island asks tRPC for the count after the page has loaded.
 *
 * Cart mutations invalidate `cart.count`, so this updates by itself.
 */
export function CartBadge() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.cart.count.queryOptions());
  return (
    <span className="pill" aria-label="Items in cart">
      {data ? data.count : "·"}
    </span>
  );
}
