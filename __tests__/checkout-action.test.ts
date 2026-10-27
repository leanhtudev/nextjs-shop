/** @jest-environment node */
import { updateTag } from "next/cache";
import { placeOrder, type CheckoutState } from "@/app/checkout/actions";
import type { Cart } from "@/server/cookies";

const mockWrite = jest.fn();
const mockRemember = jest.fn();
let mockCart: Cart = {};

jest.mock("next/cache", () => ({ updateTag: jest.fn() }));
// redirect() works by throwing; mimic that so we can assert on the target.
jest.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
jest.mock("@/server/context", () => ({
  createContext: () => ({
    cart: { read: async () => mockCart, write: mockWrite },
    orders: { ids: async () => [], remember: mockRemember },
    clientKey: async () => "test",
  }),
}));

const initial: CheckoutState = { ok: false };

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
    fullName: "Anh Tu Le",
    email: "tu@example.com",
    address: "Mannerheimintie 1",
    postalCode: "00100",
    city: "Helsinki",
    country: "FI",
    idempotencyKey: crypto.randomUUID(),
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCart = {};
});

describe("placeOrder Server Action", () => {
  it("returns field errors and echoes the typed values when validation fails", async () => {
    mockCart = { "5": 1 };
    const state = await placeOrder(initial, form({ postalCode: "12", email: "nope" }));
    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.postalCode?.[0]).toMatch(/5 digits/);
    expect(state.fieldErrors?.email).toBeDefined();
    expect(state.values?.fullName).toBe("Anh Tu Le");
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("refuses an empty cart", async () => {
    const state = await placeOrder(initial, form());
    expect(state).toMatchObject({ ok: false, message: "Your cart is empty." });
  });

  it("reports missing stock without creating an order or touching the cart", async () => {
    mockCart = { "2": 10 }; // product 2 has 7 in stock
    const state = await placeOrder(initial, form());
    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/Not enough stock/);
    expect(mockWrite).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("on success: clears the cart, remembers the order, expires the product cache, redirects", async () => {
    mockCart = { "1": 1, "6": 2 };
    await expect(placeOrder(initial, form())).rejects.toThrow(/^REDIRECT:\/orders\/ord_[0-9a-f]{12}$/);

    expect(mockWrite).toHaveBeenCalledWith({});
    expect(mockRemember).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith("product-1");
    expect(updateTag).toHaveBeenCalledWith("product-6");
    expect(updateTag).toHaveBeenCalledWith("products");
  });

  it("a double submit with the same token lands on the same order", async () => {
    mockCart = { "3": 1 };
    const key = crypto.randomUUID();
    const first = await placeOrder(initial, form({ idempotencyKey: key })).catch((e: Error) => e.message);
    mockCart = {}; // the cart was cleared by the first submit
    const second = await placeOrder(initial, form({ idempotencyKey: key })).catch((e: Error) => e.message);
    expect(first).toMatch(/^REDIRECT:\/orders\/ord_/);
    expect(second).toBe(first);
  });
});
