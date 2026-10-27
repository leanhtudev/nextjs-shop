"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState, type ReactNode } from "react";
// `import type` = erased at build time. No server code reaches the browser bundle.
import type { AppRouter } from "@/server/routers/_app";
import { makeQueryClient } from "./query-client";

/** `useTRPC()` returns a fully typed proxy: trpc.cart.add.mutationOptions(), trpc.product.liveStock.queryOptions(), ... */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  // Server: always a new client (never share cache between users).
  if (typeof window === "undefined") return makeQueryClient();
  // Browser: one client for the whole session.
  return (browserQueryClient ??= makeQueryClient());
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc" })], // batches calls made in the same tick
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
