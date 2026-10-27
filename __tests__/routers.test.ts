/** @jest-environment node */
import { TRPCError } from "@trpc/server";
import { dbCreateOrder } from "@/lib/db";
import type { Context } from "@/server/context";
import type { Cart } from "@/server/cookies";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

// unstable_cache needs Next's runtime cache; in unit tests we just call the function.
jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  updateTag: jest.fn(),
  revalidateTag: jest.fn(),
}));

const createCaller = createCallerFactory(appRouter);

/** In-memory context: this is why the context is an interface and not a hard import of next/headers. */
function fakeContext(options: { cart?: Cart; ownedOrders?: string[]; clientKey?: string } = {}) {
  let cart: Cart = { ...(options.cart ?? {}) };
  let owned = [...(options.ownedOrders ?? [])];
  const ctx: Context = {
    cart: { read: async () => ({ ...cart }), write: async (next) => void (cart = { ...next }) },
    orders: { ids: async () => owned, remember: async (id) => void (owned = [id, ...owned]) },
    clientKey: async () => options.clientKey ?? "test-client",
  };
  return { ctx, readCart: () => cart };
}

async function expectCode(promise: Promise<unknown>, code: TRPCError["code"]) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("product router", () => {
  it("returns NOT_FOUND for an unknown product", async () => {
    const api = createCaller(fakeContext().ctx);
    await expectCode(api.product.byId({ id: "does-not-exist" }), "NOT_FOUND");
  });

  it("validates input before running the procedure", async () => {
    const api = createCaller(fakeContext().ctx);
    await expectCode(api.product.search({ q: "   " }), "BAD_REQUEST");
    await expectCode(api.product.search({ q: "x".repeat(51) }), "BAD_REQUEST");
  });

  it("searches case-insensitively", async () => {
    const api = createCaller(fakeContext().ctx);
    const found = await api.product.search({ q: "TABLET" });
    expect(found.map((p) => p.name)).toEqual(["Refurbished Tablet Epsilon"]);
  });
});

describe("cart router", () => {
  it("adds items and returns the new count", async () => {
    const { ctx, readCart } = fakeContext();
    const api = createCaller(ctx);
    expect(await api.cart.add({ productId: "1", qty: 2 })).toEqual({ count: 2 });
    expect(await api.cart.add({ productId: "1", qty: 1 })).toEqual({ count: 3 });
    expect(readCart()).toEqual({ "1": 3 });
  });

  it("answers CONFLICT when the live stock is too low (the cached page may be stale)", async () => {
    const api = createCaller(fakeContext().ctx);
    // Product 4 has 3 in stock in the seed data.
    await expect(api.cart.add({ productId: "4", qty: 4 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("Only 3 in stock"),
    });
  });

  it("rejects invalid quantities with BAD_REQUEST", async () => {
    const api = createCaller(fakeContext().ctx);
    await expectCode(api.cart.add({ productId: "1", qty: 0 }), "BAD_REQUEST");
    await expectCode(api.cart.add({ productId: "1", qty: 1.5 }), "BAD_REQUEST");
    await expectCode(api.cart.add({ productId: "1", qty: 11 }), "BAD_REQUEST");
  });

  it("builds the cart summary from LIVE prices, not from anything the client sent", async () => {
    const api = createCaller(fakeContext({ cart: { "1": 1, "6": 2 } }).ctx);
    const cart = await api.cart.get();
    expect(cart.subtotalCents).toBe(34900 + 2 * 14900);
    expect(cart.lines.map((l) => l.productId)).toEqual(["1", "6"]);
  });

  it("removes a line with setQty 0", async () => {
    const { ctx, readCart } = fakeContext({ cart: { "1": 2 } });
    await createCaller(ctx).cart.setQty({ productId: "1", qty: 0 });
    expect(readCart()).toEqual({});
  });

  it("rate limits mutations per client (TOO_MANY_REQUESTS after 30 calls in 10 s)", async () => {
    const api = createCaller(fakeContext({ clientKey: "spammer" }).ctx);
    for (let i = 0; i < 30; i++) await api.cart.clear();
    await expectCode(api.cart.clear(), "TOO_MANY_REQUESTS");

    // Another client is not affected.
    await expect(createCaller(fakeContext({ clientKey: "someone-else" }).ctx).cart.clear()).resolves.toEqual({ count: 0 });
  });
});

describe("order router (authorization)", () => {
  async function placeOrder() {
    const result = await dbCreateOrder({
      items: [{ productId: "6", qty: 1 }],
      customer: { fullName: "Owner", email: "o@example.com", address: "Street 1", postalCode: "00100", city: "Helsinki", country: "FI" },
      idempotencyKey: crypto.randomUUID(),
    });
    if (!result.ok) throw new Error("setup failed");
    return result.order;
  }

  it("lets the browser that placed the order read it", async () => {
    const order = await placeOrder();
    const api = createCaller(fakeContext({ ownedOrders: [order.id] }).ctx);
    await expect(api.order.byId({ id: order.id })).resolves.toMatchObject({ id: order.id });
  });

  it("answers NOT_FOUND (not FORBIDDEN) to anyone else, so ids cannot be probed", async () => {
    const order = await placeOrder();
    const stranger = createCaller(fakeContext({ ownedOrders: [] }).ctx);
    await expectCode(stranger.order.byId({ id: order.id }), "NOT_FOUND");
  });

  it("rejects malformed ids before any lookup", async () => {
    const api = createCaller(fakeContext().ctx);
    await expectCode(api.order.byId({ id: "../../etc/passwd" }), "BAD_REQUEST");
  });
});
