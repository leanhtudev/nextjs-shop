import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { LiveStock } from "@/components/LiveStock";
import { RenderBadge } from "@/components/RenderBadge";
import { eur } from "@/lib/format";
import { loadProduct } from "@/lib/load-product";
import { serverApi } from "@/server/caller";

/**
 * ISR + on-demand generation.
 *  - revalidate: the cached page may be at most 60 s old before a rebuild is triggered.
 *  - generateStaticParams: pre-build only the first 3 products at build time.
 *  - dynamicParams (default true): any other id is rendered on its first visit and then cached.
 */
export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { items } = await serverApi().product.list();
  return items.slice(0, 3).map((p) => ({ id: p.id }));
}

type Props = { params: Promise<{ id: string }> }; // params is async in current Next.js

/** Per-page SEO metadata, generated on the server from the same cached data. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await loadProduct(id);
  return result ? { title: result.product.name, description: result.product.blurb } : { title: "Product not found" };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const result = await loadProduct(id);
  if (!result) notFound(); // renders not-found.tsx with a real 404 status
  const { product, loadedAt } = result;

  return (
    <>
      <h1>{product.name}</h1>
      <p className="muted">{product.blurb}</p>
      <p className="price">
        {eur(product.priceCents)} <small>incl. VAT</small>
      </p>

      <RenderBadge mode="ISR">
        <div>
          Product data read at <time dateTime={loadedAt}>{loadedAt}</time> (tag <code>product-{product.id}</code>)
        </div>
        <div>
          Stock in this cached page: <strong>{product.stock}</strong>
        </div>
      </RenderBadge>

      {/* Client islands: live data and interaction on top of a cached page. */}
      <LiveStock id={product.id} cachedStock={product.stock} cachedPriceCents={product.priceCents} />
      <AddToCart productId={product.id} />
    </>
  );
}
