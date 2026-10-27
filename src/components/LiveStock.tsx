"use client";

import { useQuery } from "@tanstack/react-query";
import { eur } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

/**
 * ISR pages can be up to 60 s old. This island fetches the REAL stock and price through
 * tRPC and shows them next to the cached values. This is the usual pattern for "cached
 * page + live details": the heavy page comes from the cache, the volatile bits are fetched.
 *
 * React Query refetches on an interval and when the user comes back to the tab, which is
 * why a second browser tab catches up without a manual reload.
 */
export function LiveStock({
  id,
  cachedStock,
  cachedPriceCents,
}: {
  id: string;
  cachedStock: number;
  cachedPriceCents: number;
}) {
  const trpc = useTRPC();
  const query = useQuery({ ...trpc.product.liveStock.queryOptions({ id }), refetchInterval: 15_000 });

  if (query.isPending) return <p className="live muted">Checking live stock...</p>;
  if (query.isError) return <p className="live err">Could not check live stock: {query.error.message}</p>;

  const { stock, priceCents, checkedAt } = query.data;
  const differs = stock !== cachedStock || priceCents !== cachedPriceCents;

  return (
    <p className={`live ${differs ? "live-diff" : ""}`}>
      <strong>Live:</strong> {stock} in stock, {eur(priceCents)}{" "}
      <small>(checked {new Date(checkedAt).toLocaleTimeString()}{query.isFetching ? ", refreshing..." : ""})</small>
      {differs && (
        <>
          <br />
          This page is cached and still shows {cachedStock} in stock at {eur(cachedPriceCents)}. The cart always uses
          the live values.
        </>
      )}
    </p>
  );
}
