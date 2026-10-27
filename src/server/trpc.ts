import { initTRPC, TRPCError } from "@trpc/server";
import { z, ZodError } from "zod";
import { createRateLimiter } from "@/lib/rate-limit";
import type { Context } from "./context";

/**
 * tRPC CORE: one place that defines how every procedure behaves.
 *
 * What you get from tRPC, in one sentence: write server functions, import only their
 * TYPE on the client, and the compiler checks every call (input and output) end to end.
 * No code generation, no hand-written fetch wrappers, no DTO drift.
 */
const t = initTRPC.context<Context>().create({
  // Error shape sent to the client. Zod validation problems become `error.data.zodError`
  // (field -> messages), so forms can show them next to the right input.
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

// ---------------------------------------------------------------------------
// Middleware: code that wraps procedures (logging, auth, rate limiting, ...)
// ---------------------------------------------------------------------------

/** Logs every call with its duration. Shows up in the `next start` terminal. */
const logger = t.middleware(async ({ path, type, next }) => {
  const started = performance.now();
  const result = await next();
  const ms = Math.round(performance.now() - started);
  console.log(`[trpc] ${type} ${path} ${result.ok ? "ok" : `ERR ${result.error.code}`} ${ms}ms`);
  return result;
});

/** 30 mutations per 10 s per client and procedure. A real app would use a shared store. */
const limiter = createRateLimiter({ limit: 30, windowMs: 10_000 });

const rateLimit = t.middleware(async ({ ctx, path, next }) => {
  const result = limiter.check(`${await ctx.clientKey()}:${path}`);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many requests. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s.`,
    });
  }
  return next();
});

// ---------------------------------------------------------------------------
// Procedure "bases": pick the one that matches the security needs of the endpoint.
// ---------------------------------------------------------------------------

/** Anyone may call it. Queries are read-only. */
export const publicProcedure = t.procedure.use(logger);

/** State-changing calls: logged AND rate limited. */
export const mutationProcedure = publicProcedure.use(rateLimit);
