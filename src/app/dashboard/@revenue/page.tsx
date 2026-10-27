import { SlotStamp } from "@/components/SlotStamp";
import { dbListOrders } from "@/lib/db";
import { delay } from "@/lib/delay";
import { eur } from "@/lib/format";

/** Fast panel (about 0.4 s). */
export default async function RevenueSlot() {
  await delay(300);
  const orders = await dbListOrders();
  const revenue = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const items = orders.reduce((sum, o) => sum + o.itemCount, 0);

  return (
    <>
      <h2>Revenue</h2>
      <p className="kpi">{eur(revenue)}</p>
      <p className="muted">
        {orders.length} orders, {items} items
        {orders.length > 0 && `, average ${eur(Math.round(revenue / orders.length))}`}
      </p>
      <SlotStamp name="revenue" />
    </>
  );
}
