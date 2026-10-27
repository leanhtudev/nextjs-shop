import {
  applyQuantity,
  FREE_SHIPPING_FROM_CENTS,
  MAX_QTY_PER_LINE,
  SHIPPING_CENTS,
  summarize,
  type CartLine,
  type CartSummary,
} from "@/lib/pricing";

const phone: CartLine = { productId: "1", name: "Phone", unitPriceCents: 34900, qty: 1, stock: 5 };
const watch: CartLine = { productId: "6", name: "Watch", unitPriceCents: 14900, qty: 2, stock: 5 };

describe("summarize", () => {
  it("is all zeros for an empty cart (no shipping charged)", () => {
    const s = summarize([]);
    expect(s).toMatchObject({ itemCount: 0, subtotalCents: 0, shippingCents: 0, totalCents: 0, vatIncludedCents: 0 });
  });

  it("adds shipping below the free-shipping threshold", () => {
    const s = summarize([phone]); // 349.00 < 500.00
    expect(s.subtotalCents).toBe(34900);
    expect(s.shippingCents).toBe(SHIPPING_CENTS);
    expect(s.totalCents).toBe(34900 + SHIPPING_CENTS);
    expect(s.freeShippingRemainingCents).toBe(FREE_SHIPPING_FROM_CENTS - 34900);
  });

  it("gives free shipping from the threshold on (boundary included)", () => {
    const exactly = summarize([{ ...phone, unitPriceCents: FREE_SHIPPING_FROM_CENTS, qty: 1 }]);
    expect(exactly.shippingCents).toBe(0);
    expect(exactly.freeShippingRemainingCents).toBe(0);
  });

  it("sums several lines and counts items", () => {
    const s = summarize([phone, watch]);
    expect(s.itemCount).toBe(3);
    expect(s.subtotalCents).toBe(34900 + 2 * 14900);
    expect(s.lines.map((l) => l.lineTotalCents)).toEqual([34900, 29800]);
  });

  it("works in integer cents and includes VAT in the total instead of adding it", () => {
    const s = summarize([{ ...phone, unitPriceCents: 12550 }]);
    expect(Number.isInteger(s.vatIncludedCents)).toBe(true);
    // 12550 + 900 shipping = 13450 gross; VAT part = 13450 * 0.255 / 1.255 = 2732.87 -> 2733
    expect(s.vatIncludedCents).toBe(2733);
    expect(s.totalCents).toBe(13450);
  });
});

describe("applyQuantity (optimistic update)", () => {
  const base: CartSummary = summarize([phone, watch]);

  it("changes the quantity and recomputes the totals", () => {
    const next = applyQuantity(base, "6", 1);
    expect(next.lines.find((l) => l.productId === "6")?.qty).toBe(1);
    expect(next.subtotalCents).toBe(34900 + 14900);
  });

  it("removes the line at quantity 0", () => {
    const next = applyQuantity(base, "1", 0);
    expect(next.lines.map((l) => l.productId)).toEqual(["6"]);
  });

  it("clamps to the known stock and to the per-line maximum", () => {
    expect(applyQuantity(base, "1", 99).lines[0].qty).toBe(Math.min(MAX_QTY_PER_LINE, phone.stock));
  });

  it("does not mutate the original summary", () => {
    applyQuantity(base, "1", 0);
    expect(base.lines).toHaveLength(2);
  });
});
