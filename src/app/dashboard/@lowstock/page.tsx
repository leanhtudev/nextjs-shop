import Link from "next/link";
import { SlotStamp } from "@/components/SlotStamp";
import { dbListProducts } from "@/lib/db";
import { delay } from "@/lib/delay";

const LOW_STOCK_AT = 5;

/** Medium panel (about 1.2 s). Links open the product quick-view modal (an intercepting route). */
export default async function LowStockSlot() {
  await delay(900);
  const products = await dbListProducts();
  const low = products.filter((p) => p.stock <= LOW_STOCK_AT).sort((a, b) => a.stock - b.stock);

  return (
    <>
      <h2>Low stock</h2>
      {low.length === 0 ? (
        <p className="muted">Nothing is running low.</p>
      ) : (
        <ul>
          {low.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`}>{p.name}</Link> <strong>{p.stock} left</strong>
            </li>
          ))}
        </ul>
      )}
      <SlotStamp name="lowstock" />
    </>
  );
}
