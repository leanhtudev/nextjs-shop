import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RenderBadge } from "@/components/RenderBadge";
import { eur } from "@/lib/format";
import { serverApi } from "@/server/caller";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false }, // private page: keep it out of search engines
};

type Props = { params: Promise<{ id: string }> };

/**
 * SSR + authorization. The `order.byId` procedure only answers for orders that THIS browser
 * placed (see ownedOrderProcedure). Anyone else gets NOT_FOUND, which we turn into a 404.
 */
export default async function OrderPage({ params }: Props) {
  // Mark this page as per-request explicitly. tRPC catches the error Next.js uses to detect
  // Dynamic API usage (cookies()) and rethrows it as INTERNAL_SERVER_ERROR, so Next cannot see it
  // and would try to prerender this page at build time. connection() makes the intent explicit.
  await connection();

  const { id } = await params;

  let order;
  try {
    order = await serverApi().order.byId({ id });
  } catch (error) {
    if (error instanceof TRPCError && (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")) notFound();
    throw error;
  }

  return (
    <>
      <h1>Thank you, order confirmed</h1>
      <RenderBadge mode="SSR" />

      <p>
        Order <code>{order.id}</code> placed {new Date(order.createdAt).toLocaleString("en-FI")}.
      </p>

      <h2>Items</h2>
      <table>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.productId}>
              <td>
                {line.qty} x {line.name}
              </td>
              <td>{eur(line.lineTotalCents)}</td>
            </tr>
          ))}
          <tr>
            <td>Shipping</td>
            <td>{order.shippingCents === 0 ? "Free" : eur(order.shippingCents)}</td>
          </tr>
          <tr>
            <td>
              <strong>Total</strong> <small>(incl. VAT {eur(order.vatIncludedCents)})</small>
            </td>
            <td>
              <strong>{eur(order.totalCents)}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Delivery</h2>
      <p>
        {order.customer.fullName}
        <br />
        {order.customer.address}
        <br />
        {order.customer.postalCode} {order.customer.city}, {order.customer.country}
        <br />
        <span className="muted">Confirmation sent to {order.customer.email} (demo: no email is really sent)</span>
      </p>

      <p>
        <Link href="/products">Continue shopping</Link>
      </p>
    </>
  );
}
