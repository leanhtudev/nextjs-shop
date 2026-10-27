import { clientKey, readCart, readOrderIds, rememberOrder, writeCart, type Cart } from "./cookies";

/**
 * tRPC CONTEXT: the per-request object every procedure receives as `ctx`.
 *
 * Design choice: the context is LAZY. It only exposes functions; cookies()/headers()
 * are not called until a procedure actually asks for them. That matters because
 * calling a Dynamic API opts the whole route into SSR:
 *
 *   - `product.list` / `product.byId` never touch the context, so ISR pages can call
 *     them through the server caller and stay static.
 *   - `cart.*` and `order.*` do read it, so the pages that call them are dynamic (SSR).
 *
 * It is also an interface (not a hard import), so unit tests pass a fake in-memory context.
 */
export type Context = {
  cart: {
    read: () => Promise<Cart>;
    write: (cart: Cart) => Promise<void>;
  };
  orders: {
    ids: () => Promise<string[]>;
    remember: (id: string) => Promise<void>;
  };
  clientKey: () => Promise<string>;
};

export function createContext(): Context {
  return {
    cart: { read: readCart, write: writeCart },
    orders: { ids: readOrderIds, remember: rememberOrder },
    clientKey,
  };
}
