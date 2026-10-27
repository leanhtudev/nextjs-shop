import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "@/server/context";
import { appRouter } from "@/server/routers/_app";

/**
 * The HTTP door of tRPC: /api/trpc/<procedure>.
 *  - queries use GET, mutations use POST,
 *  - several calls made in the same tick are BATCHED into one request
 *    (open the Network tab: "cart.count,product.liveStock?batch=1").
 *
 * Every procedure is a PUBLIC HTTP endpoint. The UI hiding a button protects nothing:
 * validation, authorization and rate limiting live in the procedures and middleware.
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(),
    onError({ path, error }) {
      // Expected errors (validation, not found, conflict) are normal. Only log real failures.
      if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[trpc] ${path ?? "?"} failed:`, error);
    },
  });

export { handler as GET, handler as POST };
