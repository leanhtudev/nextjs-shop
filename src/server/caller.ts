import "server-only";
import { createContext } from "./context";
import { appRouter } from "./routers/_app";
import { createCallerFactory } from "./trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * SERVER CALLER: call procedures as plain async functions from Server Components.
 * No HTTP request, no JSON round trip, but the SAME validation, middleware and types.
 *
 * Rule of thumb: never fetch() your own /api/trpc from a Server Component.
 * Call the function directly (here) instead.
 */
export const serverApi = () => createCaller(createContext());
