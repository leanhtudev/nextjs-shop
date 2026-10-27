import { z } from "zod";

/**
 * One schema, two users:
 *  - the Server Action validates with it (the only validation that counts),
 *  - the client could reuse it for instant feedback (it has no server-only imports).
 *
 * Note what is NOT here: prices, totals, product ids. The server derives those from
 * the cart cookie + the database. Anything the browser sends about money is ignored.
 */
export const COUNTRIES = ["FI", "SE", "EE"] as const;

export const CheckoutSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Too long"),
  email: z.email("Enter a valid email address").max(120, "Too long"),
  address: z.string().trim().min(5, "Enter your street address").max(120, "Too long"),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Postal code must be 5 digits"),
  city: z.string().trim().min(2, "Enter your city").max(60, "Too long"),
  country: z.enum(COUNTRIES, "Choose a country"),
  /** Random token created when the page was rendered. Makes a double click safe. */
  idempotencyKey: z.uuid("Invalid form token, reload the page"),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;
