"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { eur } from "@/lib/format";
import { applyQuantity, MAX_QTY_PER_LINE } from "@/lib/pricing";
import { useTRPC } from "@/trpc/client";

/**
 * Interactive cart. The data was PREFETCHED on the server (cart page) and hydrated here,
 * so there is no loading flash. Changing a quantity is OPTIMISTIC:
 *   1. onMutate  : update the cached cart immediately (the UI reacts at once),
 *   2. server    : tRPC validates, re-checks stock, writes the cookie,
 *   3. onError   : put the previous cart back if the server said no,
 *   4. onSettled : refetch so the screen matches the server again.
 */
export function CartView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const cartQuery = useQuery(trpc.cart.get.queryOptions());
  const cartKey = trpc.cart.get.queryKey();

  const setQty = useMutation(
    trpc.cart.setQty.mutationOptions({
      onMutate: async ({ productId, qty }) => {
        await queryClient.cancelQueries({ queryKey: cartKey }); // do not let an in-flight refetch overwrite us
        const previous = queryClient.getQueryData(cartKey);
        queryClient.setQueryData(cartKey, (old) => (old ? applyQuantity(old, productId, qty) : old));
        return { previous };
      },
      onError: (_error, _vars, rollback) => {
        if (rollback?.previous) queryClient.setQueryData(cartKey, rollback.previous);
      },
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: cartKey }),
          queryClient.invalidateQueries(trpc.cart.count.queryFilter()),
        ]),
    }),
  );

  if (cartQuery.isPending) return <p className="muted">Loading cart...</p>;
  if (cartQuery.isError) return <p className="err">Could not load the cart: {cartQuery.error.message}</p>;

  const cart = cartQuery.data;
  if (cart.lines.length === 0) {
    return (
      <p>
        Your cart is empty. <Link href="/products">Browse products</Link>
      </p>
    );
  }

  const hasShortage = cart.lines.some((l) => l.qty > l.stock);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Quantity</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {cart.lines.map((line) => (
            <tr key={line.productId}>
              <td>
                <Link href={`/products/${line.productId}`}>{line.name}</Link>
                {line.qty > line.stock && <div className="err">Only {line.stock} left in stock</div>}
              </td>
              <td>{eur(line.unitPriceCents)}</td>
              <td>
                <span className="qty">
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Decrease quantity of ${line.name}`}
                    onClick={() => setQty.mutate({ productId: line.productId, qty: line.qty - 1 })}
                  >
                    -
                  </button>
                  <span aria-live="polite">{line.qty}</span>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Increase quantity of ${line.name}`}
                    disabled={line.qty >= Math.min(line.stock, MAX_QTY_PER_LINE)}
                    onClick={() => setQty.mutate({ productId: line.productId, qty: line.qty + 1 })}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setQty.mutate({ productId: line.productId, qty: 0 })}
                  >
                    Remove
                  </button>
                </span>
              </td>
              <td>{eur(line.lineTotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="summary">
        <div>
          Subtotal <strong>{eur(cart.subtotalCents)}</strong>
        </div>
        <div>
          Shipping <strong>{cart.shippingCents === 0 ? "Free" : eur(cart.shippingCents)}</strong>
          {cart.shippingCents > 0 && (
            <small> (free from {eur(cart.subtotalCents + cart.freeShippingRemainingCents)}, add {eur(cart.freeShippingRemainingCents)} more)</small>
          )}
        </div>
        <div>
          Total <strong>{eur(cart.totalCents)}</strong> <small>incl. VAT {eur(cart.vatIncludedCents)}</small>
        </div>
      </div>

      {setQty.error && <p className="err" role="alert">{setQty.error.message}</p>}

      {hasShortage ? (
        <p className="err">Some items exceed the available stock. Lower the quantity to continue.</p>
      ) : (
        <p>
          <Link href="/checkout" className="button">
            Go to checkout
          </Link>
        </p>
      )}
    </>
  );
}
