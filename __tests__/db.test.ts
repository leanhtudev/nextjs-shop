/** @jest-environment node */
import { dbCreateOrder, dbGetProduct, type Customer } from "@/lib/db";

const customer: Customer = {
  fullName: "Test Buyer",
  email: "buyer@example.com",
  address: "Testikatu 1",
  postalCode: "00100",
  city: "Helsinki",
  country: "FI",
};

// Product 4 starts with stock 3 in the seed data.
describe("dbCreateOrder", () => {
  it("never oversells: two concurrent orders for the last items, only one wins", async () => {
    const [a, b] = await Promise.all([
      dbCreateOrder({ items: [{ productId: "4", qty: 2 }], customer, idempotencyKey: crypto.randomUUID() }),
      dbCreateOrder({ items: [{ productId: "4", qty: 2 }], customer, idempotencyKey: crypto.randomUUID() }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);

    const loser = a.ok ? b : a;
    expect(loser.ok).toBe(false);
    if (!loser.ok) expect(loser.shortages[0]).toMatchObject({ productId: "4", requested: 2, available: 1 });

    expect((await dbGetProduct("4"))?.stock).toBe(1);
  });

  it("is idempotent: the same key returns the same order and takes stock only once", async () => {
    const key = crypto.randomUUID();
    const before = (await dbGetProduct("3"))!.stock;

    const first = await dbCreateOrder({ items: [{ productId: "3", qty: 1 }], customer, idempotencyKey: key });
    const second = await dbCreateOrder({ items: [{ productId: "3", qty: 1 }], customer, idempotencyKey: key });

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.order.id).toBe(first.order.id);
      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
    }
    expect((await dbGetProduct("3"))?.stock).toBe(before - 1);
  });

  it("is all or nothing: one short item means no stock is taken at all", async () => {
    const before = (await dbGetProduct("6"))!.stock;
    const result = await dbCreateOrder({
      items: [
        { productId: "6", qty: 1 },
        { productId: "2", qty: 999 },
      ],
      customer,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    expect((await dbGetProduct("6"))?.stock).toBe(before);
  });

  it("uses the database price and keeps a snapshot on the order", async () => {
    const product = (await dbGetProduct("5"))!;
    const result = await dbCreateOrder({
      items: [{ productId: "5", qty: 2 }],
      customer,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.lines[0]).toMatchObject({ unitPriceCents: product.priceCents, qty: 2 });
      expect(result.order.subtotalCents).toBe(product.priceCents * 2);
    }
  });

  it("rejects an empty cart", async () => {
    const result = await dbCreateOrder({ items: [], customer, idempotencyKey: crypto.randomUUID() });
    expect(result).toMatchObject({ ok: false, reason: "EMPTY_CART" });
  });
});

describe("dbListOrders (dashboard data)", () => {
  it("returns seeded and new orders, newest first", async () => {
    const { dbListOrders } = await import("@/lib/db");
    const before = await dbListOrders();
    expect(before.length).toBeGreaterThanOrEqual(3);

    const created = await dbCreateOrder({
      items: [{ productId: "6", qty: 1 }],
      customer,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);

    const after = await dbListOrders();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0].id).toBe(created.ok ? created.order.id : "");
    const times = after.map((o) => o.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
