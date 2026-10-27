import Link from "next/link";

/** Fully static page (SSG): built once, served from the cache, no data fetching at all. */
export default function HomePage() {
  return (
    <>
      <h1>Refurb Shop</h1>
      <p>
        An example e-commerce site that shows which Next.js feature belongs where. Run it in production mode
        (<code>npm run preview</code>) and watch the timestamp on each page.
      </p>

      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Rendering</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><Link href="/">/</Link></td>
            <td>Static (SSG)</td>
            <td>Never changes, built once.</td>
          </tr>
          <tr>
            <td><Link href="/products">/products</Link></td>
            <td>ISR, 30 s</td>
            <td>Same for everyone, changes now and then. Fast cached page, rebuilt in the background.</td>
          </tr>
          <tr>
            <td><Link href="/products/1">/products/[id]</Link></td>
            <td>ISR, 60 s + on-demand</td>
            <td>Top products pre-built, the long tail generated on first visit. Live stock fetched by tRPC.</td>
          </tr>
          <tr>
            <td><Link href="/cart">/cart</Link></td>
            <td>SSR + streaming</td>
            <td>Depends on the visitor&apos;s cookie, needs live prices. Recommendations stream in later.</td>
          </tr>
          <tr>
            <td><Link href="/checkout">/checkout</Link></td>
            <td>SSR + Server Action</td>
            <td>Per-visitor, money involved. The form posts to a Server Action.</td>
          </tr>
          <tr>
            <td><Link href="/dashboard">/dashboard</Link></td>
            <td>Parallel routes (dynamic)</td>
            <td>Three slots (@revenue, @lowstock, @activity) stream and fail independently.</td>
          </tr>
          <tr>
            <td>/products/[id] from a link</td>
            <td>Parallel + intercepting route</td>
            <td>Opens as a quick-view modal over the list. A reload or direct link shows the full page.</td>
          </tr>
          <tr>
            <td>/orders/[id]</td>
            <td>SSR + authorization</td>
            <td>Private data. Only the browser that placed the order can read it.</td>
          </tr>
        </tbody>
      </table>

      <p className="look">
        <strong>Try this:</strong> add a product to the cart, open the cart, go through checkout, then open the product
        page again. The stock went down: checkout invalidated the product cache.
      </p>
    </>
  );
}
