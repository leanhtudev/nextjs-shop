import { CheckoutSchema } from "@/lib/checkout-schema";

const valid = {
  fullName: "Anh Tu Le",
  email: "tu@example.com",
  address: "Mannerheimintie 1",
  postalCode: "00100",
  city: "Helsinki",
  country: "FI",
  idempotencyKey: "3b241101-e2bb-4255-8caf-4136c566a962",
};

describe("CheckoutSchema", () => {
  it("accepts a valid form and trims whitespace", () => {
    const result = CheckoutSchema.safeParse({ ...valid, fullName: "  Anh Tu Le  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBe("Anh Tu Le");
  });

  it.each([
    ["email", "not-an-email"],
    ["postalCode", "1234"],
    ["postalCode", "12a45"],
    ["country", "XX"],
    ["fullName", "A"],
    ["idempotencyKey", "not-a-uuid"],
  ])("rejects an invalid %s (%s)", (field, value) => {
    const result = CheckoutSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
  });

  it("ignores unknown fields such as a client-sent price", () => {
    const result = CheckoutSchema.safeParse({ ...valid, totalCents: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("totalCents");
  });
});
