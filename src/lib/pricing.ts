/**
 * Pure pricing logic: no I/O, no framework imports.
 *
 * Why it lives in its own file:
 *  - the SERVER uses it to compute the real totals (never trust the client),
 *  - the CLIENT uses it for optimistic updates (instant UI before the server answers),
 *  - Jest can test it without mocking anything.
 *
 * Money is stored as integer CENTS. Floats and money do not mix (0.1 + 0.2 !== 0.3).
 */

export const MAX_QTY_PER_LINE = 10;
export const FREE_SHIPPING_FROM_CENTS = 50_000; // free shipping from EUR 500
export const SHIPPING_CENTS = 900;
export const VAT_RATE = 0.255; // Finnish standard VAT, included in the displayed prices

export type Priced = { unitPriceCents: number; qty: number };

export type Summary<L extends Priced> = {
  lines: Array<L & { lineTotalCents: number }>;
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  /** The VAT portion that is already inside totalCents. */
  vatIncludedCents: number;
  freeShippingRemainingCents: number;
};

export function summarize<L extends Priced>(lines: L[]): Summary<L> {
  const priced = lines.map((l) => ({ ...l, lineTotalCents: l.unitPriceCents * l.qty }));
  const subtotalCents = priced.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const itemCount = priced.reduce((sum, l) => sum + l.qty, 0);
  const shippingCents = subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_FROM_CENTS ? 0 : SHIPPING_CENTS;
  const totalCents = subtotalCents + shippingCents;
  const vatIncludedCents = Math.round((totalCents * VAT_RATE) / (1 + VAT_RATE));
  const freeShippingRemainingCents =
    subtotalCents >= FREE_SHIPPING_FROM_CENTS ? 0 : FREE_SHIPPING_FROM_CENTS - subtotalCents;
  return { lines: priced, itemCount, subtotalCents, shippingCents, totalCents, vatIncludedCents, freeShippingRemainingCents };
}

/** A cart line as the cart page needs it: live price and live stock included. */
export type CartLine = {
  productId: string;
  name: string;
  unitPriceCents: number;
  qty: number;
  stock: number;
};

export type CartSummary = Summary<CartLine>;

/**
 * Optimistic update: what the cart WILL look like once the server accepts the change.
 * qty <= 0 removes the line. The quantity is clamped to the stock we know about.
 */
export function applyQuantity(summary: CartSummary, productId: string, qty: number): CartSummary {
  const lines = summary.lines
    .map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, MAX_QTY_PER_LINE, l.stock) } : l))
    .filter((l) => l.qty > 0);
  return summarize(lines);
}
