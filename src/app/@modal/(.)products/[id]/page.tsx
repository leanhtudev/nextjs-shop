import { AddToCart } from "@/components/AddToCart";
import { LiveStock } from "@/components/LiveStock";
import { Modal } from "@/components/Modal";
import { eur } from "@/lib/format";
import { loadProduct } from "@/lib/load-product";

type Props = { params: Promise<{ id: string }> };

/**
 * INTERCEPTING ROUTE. `(.)products/[id]` means: "when the app navigates to /products/[id] with a
 * <Link> (a soft navigation), render THIS inside the @modal slot instead, and keep the current page
 * (the list, the dashboard, ...) on screen behind it."
 *
 * A reload, a shared link or a search engine requesting /products/[id] is NOT intercepted:
 * it gets the real page in app/products/[id]/page.tsx.
 *
 * `(.)` matches segments by URL level, not by folder, so the @modal folder does not count.
 */
export default async function QuickViewModal({ params }: Props) {
  const { id } = await params;
  const result = await loadProduct(id);

  if (!result) {
    return (
      <Modal title="Product not found">
        <h2>Product not found</h2>
        <p className="muted">That product does not exist any more.</p>
      </Modal>
    );
  }

  const { product } = result;
  return (
    <Modal title={product.name}>
      <h2>{product.name}</h2>
      <p className="muted">{product.blurb}</p>
      <p className="price">
        {eur(product.priceCents)} <small>incl. VAT</small>
      </p>
      <LiveStock id={product.id} cachedStock={product.stock} cachedPriceCents={product.priceCents} />
      <AddToCart productId={product.id} />
      <p>
        {/* A plain anchor = full page load = no interception: opens the real product page. */}
        <a href={`/products/${product.id}`}>Open the full page</a>
      </p>
    </Modal>
  );
}
