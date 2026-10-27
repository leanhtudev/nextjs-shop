import "server-only";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache, type ReactNode } from "react";
import { createContext } from "@/server/context";
import { appRouter } from "@/server/routers/_app";
import { makeQueryClient } from "./query-client";

/** One QueryClient per request (React `cache` scopes it to the current render). */
export const getQueryClient = cache(makeQueryClient);

/**
 * Server-side options proxy: same shape as `useTRPC()` on the client, but it calls the
 * router directly (no HTTP). Use it to PREFETCH data in a Server Component:
 *
 *   await getQueryClient().prefetchQuery(trpc.cart.get.queryOptions());
 *
 * and then wrap the client components in <HydrateClient>, so they start with that data
 * already in their cache (no loading spinner, no second request).
 */
export const trpc = createTRPCOptionsProxy({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

export function HydrateClient({ children }: { children: ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}
