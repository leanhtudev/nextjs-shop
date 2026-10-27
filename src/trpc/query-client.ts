import { QueryClient } from "@tanstack/react-query";

/**
 * One QueryClient factory for server and browser.
 * staleTime 30 s: data that was prefetched on the server is NOT fetched again right
 * after hydration. It is still refreshed when the user returns to the tab (refetchOnWindowFocus).
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  });
}
