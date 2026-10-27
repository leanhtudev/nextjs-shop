import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CartView } from "@/components/CartView";
import { Recommendations } from "@/components/Recommendations";
import { RenderBadge } from "@/components/RenderBadge";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Cart" };

/**
 * SSR. `trpc.cart.get` reads the cart cookie through the tRPC context, which is a Dynamic
 * API, so this route is rendered on EVERY request (never cached).
 *
 * Pattern: PREFETCH + HYDRATE.
 *   1. the server prefetches the cart into a per-request QueryClient (no HTTP, direct call),
 *   2. <HydrateClient> ships that cache to the browser,
 *   3. <CartView /> (a client component) starts with data already in place.
 * The user sees the real cart in the first HTML, then gets interactivity and optimistic updates.
 */
export default async function CartPage() {
  // Mark this page as per-request explicitly. tRPC catches the error Next.js uses to detect
  // Dynamic API usage (cookies()) and rethrows it as INTERNAL_SERVER_ERROR, so Next cannot see it
  // and would try to prerender this page at build time. connection() makes the intent explicit.
  await connection();

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.cart.get.queryOptions());
  const cart = queryClient.getQueryData(trpc.cart.get.queryKey());
  const inCart = cart?.lines.map((l) => l.productId) ?? [];

  return (
    <>
      <h1>Cart</h1>
      <RenderBadge mode="SSR" />

      <HydrateClient>
        <CartView />
      </HydrateClient>

      {/* Streaming: the shell and the cart are sent first, this block follows when it is ready. */}
      <Suspense fallback={<p className="muted">Loading recommendations...</p>}>
        <Recommendations excludeIds={inCart} />
      </Suspense>
    </>
  );
}
