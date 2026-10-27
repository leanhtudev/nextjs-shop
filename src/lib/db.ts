import "server-only";
import { randomBytes } from "node:crypto";
import type { CheckoutInput } from "./checkout-schema";
import { summarize } from "./pricing";

/**
 * In-memory "database" for the shop.
 *
 * - Pinned to `globalThis` so hot reloads in `next dev` do not reset it.
 * - Reads have an artificial delay so uncached pages feel slow and caching is visible.
 * - `dbReads()` counts reads: a page served from cache does NOT move it.
 *
 * NOTE: `next build` and `next start` are separate processes, so the build pre-renders
 * with the seed data and the running server starts with its own fresh copy.
 */

export type Product = {
  id: string;
  name: string;
  blurb: string;
  priceCents: number;
  stock: number;
  updatedAt: string;
};

export type Customer = Omit<CheckoutInput, "idempotencyKey">;

export type OrderLine = {
  productId: string;
  name: string;
  /** Price at the moment of purchase. Orders keep a snapshot, later price changes do not touch them. */
  unitPriceCents: number;
  qty: number;
};

export type Order = {
  id: string;
  createdAt: string;
  status: "confirmed";
  customer: Customer;
  lines: Array<OrderLine & { lineTotalCents: number }>;
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  vatIncludedCents: number;
};

const now = () => new Date().toISOString();

const seed: Product[] = [
  { id: "1", name: "Refurbished Phone Alpha 128 GB", blurb: "Everyday flagship, battery replaced.", priceCents: 34900, stock: 12, updatedAt: now() },
  { id: "2", name: "Refurbished Phone Beta 256 GB", blurb: "Great camera, like-new condition.", priceCents: 42900, stock: 7, updatedAt: now() },
  { id: "3", name: "Refurbished Phone Gamma 64 GB", blurb: "Budget pick, fully tested.", priceCents: 21900, stock: 20, updatedAt: now() },
  { id: "4", name: "Refurbished Phone Delta 512 GB", blurb: "Top storage, limited stock.", priceCents: 59900, stock: 3, updatedAt: now() },
  { id: "5", name: "Refurbished Tablet Epsilon", blurb: "10-inch tablet for the couch.", priceCents: 28900, stock: 9, updatedAt: now() },
  { id: "6", name: "Refurbished Watch Zeta", blurb: "Fitness tracking on your wrist.", priceCents: 14900, stock: 15, updatedAt: now() },
];

/** A few historical orders so the dashboard has something to show on a fresh start. */
function seedOrders(): Order[] {
  const make = (n: number, hoursAgo: number, items: Array<[string, number]>): Order => {
    const lines: OrderLine[] = items.map(([productId, qty]) => {
      const product = seed.find((p) => p.id === productId)!;
      return { productId, name: product.name, unitPriceCents: product.priceCents, qty };
    });
    const s = summarize(lines);
    return {
      id: `ord_5eed0000000${n}`,
      createdAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
      status: "confirmed",
      customer: { fullName: "Demo Customer", email: `demo${n}@example.com`, address: "Demostreet 1", postalCode: "00100", city: "Helsinki", country: "FI" },
      lines: s.lines,
      itemCount: s.itemCount,
      subtotalCents: s.subtotalCents,
      shippingCents: s.shippingCents,
      totalCents: s.totalCents,
      vatIncludedCents: s.vatIncludedCents,
    };
  };
  return [make(1, 30, [["1", 1]]), make(2, 5, [["2", 1], ["6", 2]]), make(3, 1, [["5", 1]])];
}

type Store = {
  products: Map<string, Product>;
  orders: Map<string, Order>;
  /** idempotency key -> order id. A repeated submit returns the same order instead of a second one. */
  idempotency: Map<string, string>;
  reads: number;
};

const g = globalThis as unknown as { __nextShopStore?: Store };
const store: Store = (g.__nextShopStore ??= {
  products: new Map(seed.map((p) => [p.id, p])),
  orders: new Map(seedOrders().map((o) => [o.id, o])),
  idempotency: new Map(),
  reads: 0,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function dbListProducts(): Promise<Product[]> {
  store.reads++;
  await sleep(250);
  return [...store.products.values()].map((p) => ({ ...p }));
}

export async function dbGetProduct(id: string): Promise<Product | null> {
  store.reads++;
  await sleep(250);
  const product = store.products.get(id);
  return product ? { ...product } : null;
}

export async function dbUpdateProduct(
  id: string,
  patch: Partial<Pick<Product, "priceCents" | "stock">>,
): Promise<Product | null> {
  const product = store.products.get(id);
  if (!product) return null;
  const updated: Product = { ...product, ...patch, updatedAt: now() };
  store.products.set(id, updated);
  return { ...updated };
}

export function dbReads(): number {
  return store.reads;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type Shortage = { productId: string; name: string; requested: number; available: number };

export type CreateOrderResult =
  | { ok: true; order: Order; replayed: boolean }
  | { ok: false; reason: "EMPTY_CART" | "OUT_OF_STOCK"; shortages: Shortage[] };

/**
 * Create an order: check stock, decrement stock, store the order. All or nothing.
 *
 * The check and the decrement happen in ONE synchronous block, so two concurrent
 * checkouts cannot both take the last item (Node runs this block without interruption).
 * In a real database you get the same guarantee from a transaction and a conditional
 * update: `UPDATE products SET stock = stock - $qty WHERE id = $id AND stock >= $qty`.
 *
 * Prices are read from the database HERE. The cart (cookie) only supplies ids and quantities.
 */
export async function dbCreateOrder(args: {
  items: Array<{ productId: string; qty: number }>;
  customer: Customer;
  idempotencyKey: string;
}): Promise<CreateOrderResult> {
  await sleep(150); // simulated latency of a real write

  // Idempotency: the same form submitted twice returns the first order.
  const existingId = store.idempotency.get(args.idempotencyKey);
  if (existingId) {
    const existing = store.orders.get(existingId);
    if (existing) return { ok: true, order: structuredClone(existing), replayed: true };
  }

  if (args.items.length === 0) return { ok: false, reason: "EMPTY_CART", shortages: [] };

  const shortages: Shortage[] = [];
  for (const { productId, qty } of args.items) {
    const product = store.products.get(productId);
    if (!product) {
      shortages.push({ productId, name: "Unknown product", requested: qty, available: 0 });
    } else if (product.stock < qty) {
      shortages.push({ productId, name: product.name, requested: qty, available: product.stock });
    }
  }
  if (shortages.length > 0) return { ok: false, reason: "OUT_OF_STOCK", shortages };

  const lines: OrderLine[] = args.items.map(({ productId, qty }) => {
    const product = store.products.get(productId)!;
    product.stock -= qty;
    product.updatedAt = now();
    return { productId, name: product.name, unitPriceCents: product.priceCents, qty };
  });

  const s = summarize(lines);
  const order: Order = {
    id: `ord_${randomBytes(6).toString("hex")}`, // unguessable id, ownership is still checked separately
    createdAt: now(),
    status: "confirmed",
    customer: args.customer,
    lines: s.lines,
    itemCount: s.itemCount,
    subtotalCents: s.subtotalCents,
    shippingCents: s.shippingCents,
    totalCents: s.totalCents,
    vatIncludedCents: s.vatIncludedCents,
  };
  store.orders.set(order.id, order);
  store.idempotency.set(args.idempotencyKey, order.id);
  return { ok: true, order: structuredClone(order), replayed: false };
}

export async function dbGetOrder(id: string): Promise<Order | null> {
  store.reads++;
  await sleep(100);
  const order = store.orders.get(id);
  return order ? structuredClone(order) : null;
}

/** Newest first. Callers must only pass non-personal fields on to the UI. */
export async function dbListOrders(): Promise<Order[]> {
  store.reads++;
  await sleep(50);
  return [...store.orders.values()]
    .map((o) => structuredClone(o))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
