import type { Metadata } from "next";
import Link from "next/link";
import { RenderBadge } from "@/components/RenderBadge";
import { SearchBox } from "@/components/SearchBox";
import { eur } from "@/lib/format";
import { serverApi } from "@/server/caller";

export const metadata: Metadata = { title: "Products" };

/**
 * ISR, time-based. Pre-rendered at build time, then served from the cache.
 * After 30 s the next visitor still gets the old page (stale) and triggers a rebuild in the
 * background; the visitor after that gets the new page. Must be a literal number.
 *
 * The data comes from the tRPC SERVER CALLER (a direct function call, no HTTP). It stays
 * ISR because the tRPC context is lazy: `product.list` never reads cookies.
 */
export const revalidate = 30;

export default async function ProductsPage() {
  const { items, loadedAt } = await serverApi().product.list();

  return (
    <>
      <h1>Products</h1>
      <RenderBadge mode="ISR">
        <div>
          Data read from the DB at <time dateTime={loadedAt}>{loadedAt}</time> (tag <code>products</code>)
        </div>
      </RenderBadge>

      <SearchBox />

      <div className="grid">
        {items.map((p) => (
          <article key={p.id} className="card">
            <h2>
              <Link href={`/products/${p.id}`}>{p.name}</Link>
            </h2>
            <p className="muted">{p.blurb}</p>
            <p className="price">{eur(p.priceCents)}</p>
            <p>
              <small>{p.stock > 0 ? `${p.stock} in stock (as of this cached page)` : "Out of stock"}</small>
            </p>
          </article>
        ))}
      </div>

      <p className="look">
        <strong>What to look for:</strong> reload several times. The HTML timestamp stays put (cache hit). The product
        pages show live stock from tRPC next to the cached value.
      </p>
    </>
  );
}
