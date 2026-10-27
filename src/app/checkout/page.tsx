import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CheckoutForm } from "@/components/CheckoutForm";
import { RenderBadge } from "@/components/RenderBadge";
import { eur } from "@/lib/format";
import { serverApi } from "@/server/caller";

export const metadata: Metadata = { title: "Checkout" };

/** SSR: per-visitor (cart cookie) and money is involved, so it is never cached. */
export default async function CheckoutPage() {
  // Mark this page as per-request explicitly. tRPC catches the error Next.js uses to detect
  // Dynamic API usage (cookies()) and rethrows it as INTERNAL_SERVER_ERROR, so Next cannot see it
  // and would try to prerender this page at build time. connection() makes the intent explicit.
  await connection();

  const cart = await serverApi().cart.get();
  if (cart.lines.length === 0) redirect("/cart");

  const shortages = cart.lines.filter((l) => l.qty > l.stock);

  return (
    <>
      <h1>Checkout</h1>
      <RenderBadge mode="SSR" />

      <h2>Order summary</h2>
      <table>
        <tbody>
          {cart.lines.map((line) => (
            <tr key={line.productId}>
              <td>
                {line.qty} x {line.name}
              </td>
              <td>{eur(line.lineTotalCents)}</td>
            </tr>
          ))}
          <tr>
            <td>Shipping</td>
            <td>{cart.shippingCents === 0 ? "Free" : eur(cart.shippingCents)}</td>
          </tr>
          <tr>
            <td>
              <strong>Total</strong> <small>(incl. VAT {eur(cart.vatIncludedCents)})</small>
            </td>
            <td>
              <strong>{eur(cart.totalCents)}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {shortages.length > 0 ? (
        <p className="err">
          Not enough stock for: {shortages.map((l) => `${l.name} (only ${l.stock} left)`).join(", ")}.{" "}
          <Link href="/cart">Update your cart</Link>
        </p>
      ) : (
        <>
          <h2>Delivery details</h2>
          {/* A fresh token per render: the same submit sent twice creates ONE order. */}
          <CheckoutForm idempotencyKey={randomUUID()} totalLabel={eur(cart.totalCents)} />
        </>
      )}
    </>
  );
}
