import { router } from "../trpc";
import { cartRouter } from "./cart";
import { orderRouter } from "./order";
import { productRouter } from "./product";

/** The root router. Clients import ONLY `type AppRouter`, never this file's code. */
export const appRouter = router({
  product: productRouter,
  cart: cartRouter,
  order: orderRouter,
});

export type AppRouter = typeof appRouter;
