import "server-only";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { MAX_QTY_PER_LINE } from "@/lib/pricing";

/**
 * Cookie-backed state: the cart and "which orders did this browser place".
 *
 * Rules applied here:
 *  - HttpOnly: JavaScript in the page (and any XSS) cannot read these cookies.
 *  - SameSite=Lax: a cross-site POST does not carry them (basic CSRF protection for our POSTs).
 *  - The cart stores ONLY product ids and quantities. Prices always come from the database.
 *  - Cookie contents are untrusted input: parse and validate them like a request body.
 *  - Set COOKIE_SECURE=1 when serving over HTTPS (it is left off so http://localhost works everywhere).
 */

const CART_COOKIE = "shop_cart";
const ORDERS_COOKIE = "shop_orders";
const ONE_DAY = 60 * 60 * 24;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "1",
  path: "/",
  maxAge: ONE_DAY,
};

export const CartSchema = z
  .record(z.string().min(1).max(20), z.number().int().min(1).max(MAX_QTY_PER_LINE))
  .refine((cart) => Object.keys(cart).length <= 20, "Too many lines");
export type Cart = z.infer<typeof CartSchema>;

const OrderIdsSchema = z.array(z.string().regex(/^ord_[0-9a-f]{12}$/)).max(20);

function parseJson<T>(raw: string | undefined, schema: z.ZodType<T>, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

/** Reading cookies() is a Dynamic API: any route that calls this renders per request (SSR). */
export async function readCart(): Promise<Cart> {
  return parseJson((await cookies()).get(CART_COOKIE)?.value, CartSchema, {});
}

export async function writeCart(cart: Cart): Promise<void> {
  const store = await cookies();
  if (Object.keys(cart).length === 0) store.delete(CART_COOKIE);
  else store.set(CART_COOKIE, JSON.stringify(cart), cookieOptions);
}

export async function readOrderIds(): Promise<string[]> {
  return parseJson((await cookies()).get(ORDERS_COOKIE)?.value, OrderIdsSchema, []);
}

export async function rememberOrder(id: string): Promise<void> {
  const ids = await readOrderIds();
  const next = [id, ...ids.filter((x) => x !== id)].slice(0, 20);
  (await cookies()).set(ORDERS_COOKIE, JSON.stringify(next), cookieOptions);
}

/**
 * Who is calling? Used as the rate-limit key.
 * x-forwarded-for can be spoofed unless a trusted proxy (CloudFront/ALB) sets it,
 * so in production take the value your proxy guarantees.
 */
export async function clientKey(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}
