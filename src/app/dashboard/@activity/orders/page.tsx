import Link from "next/link";
import { SlotStamp } from "@/components/SlotStamp";
import { dbListOrders } from "@/lib/db";
import { delay } from "@/lib/delay";
import { eur } from "@/lib/format";

/**
 * A sub-route that exists ONLY inside the @activity slot: /dashboard/orders.
 * On a client-side navigation (clicking "All orders") only this panel changes; the
 * @revenue and @lowstock panels keep their current content (soft navigation).
 * On a full page load of this URL they have no page for it and render their default.tsx.
 */
export default async function AllOrdersSlot() {
  await delay(500);
  const orders = await dbListOrders();

  return (
    <>
      <h2>All orders</h2>
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Placed</th>
            <th>Items</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <code>{o.id}</code>
              </td>
              <td>{new Date(o.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC</td>
              <td>{o.itemCount}</td>
              <td>{eur(o.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <Link href="/dashboard">&larr; Back to the dashboard</Link>
      </p>
      <SlotStamp name="all-orders" />
    </>
  );
}
