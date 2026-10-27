import Link from "next/link";
import { SlotStamp } from "@/components/SlotStamp";
import { dbListOrders } from "@/lib/db";
import { delay } from "@/lib/delay";
import { eur } from "@/lib/format";

type Props = { searchParams: Promise<{ fail?: string }> };

/**
 * Slow panel (about 1.7 s). Slot pages receive `searchParams` like any page, so
 * /dashboard?fail=activity can simulate a broken backend for THIS panel only.
 * Only non-personal order fields are rendered (id, time, items, total).
 */
export default async function ActivitySlot({ searchParams }: Props) {
  const { fail } = await searchParams;
  await delay(1500);
  if (fail === "activity") throw new Error("Activity service unavailable (simulated)");

  const orders = (await dbListOrders()).slice(0, 5);

  return (
    <>
      <h2>Recent activity</h2>
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
        <Link href="/dashboard/orders">All orders &rarr;</Link>
      </p>
      <SlotStamp name="activity" />
    </>
  );
}
