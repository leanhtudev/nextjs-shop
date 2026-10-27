import Link from "next/link";
import { dbListProducts } from "@/lib/db";
import { eur } from "@/lib/format";

/**
 * Deliberately SLOW Server Component (simulates a recommendation service).
 *
 * The cart page wraps it in <Suspense>. With SSR streaming the server sends the page
 * shell and the cart FIRST, and this block arrives later in the same response.
 * The slow part does not block the important part.
 */
export async function Recommendations({ excludeIds }: { excludeIds: string[] }) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  const all = await dbListProducts();
  const picks = all.filter((p) => p.stock > 0 && !excludeIds.includes(p.id)).slice(0, 3);

  return (
    <section>
      <h2>You may also like</h2>
      <ul>
        {picks.map((p) => (
          <li key={p.id}>
            <Link href={`/products/${p.id}`}>{p.name}</Link> <span className="muted">{eur(p.priceCents)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
