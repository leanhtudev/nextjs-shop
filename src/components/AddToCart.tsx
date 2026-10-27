"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { MAX_QTY_PER_LINE } from "@/lib/pricing";
import { useTRPC } from "@/trpc/client";

/** Add to cart with a typed tRPC mutation. */
export function AddToCart({ productId }: { productId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);

  const add = useMutation(
    trpc.cart.add.mutationOptions({
      // The cart changed: refresh the header count and the cart data.
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries(trpc.cart.count.queryFilter()),
          queryClient.invalidateQueries(trpc.cart.get.queryFilter()),
        ]),
    }),
  );

  // Two kinds of errors reach the client:
  //  - validation (zodError, field -> messages) and
  //  - business errors (CONFLICT "Only 3 in stock", TOO_MANY_REQUESTS, ...), with a readable message.
  const fieldErrors = add.error?.data?.zodError?.fieldErrors;
  const errorText = add.error
    ? fieldErrors && Object.keys(fieldErrors).length > 0
      ? Object.values(fieldErrors).flat().join(", ")
      : add.error.message
    : null;

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate({ productId, qty });
      }}
    >
      <div className="row">
        <label>
          Quantity
          <input
            type="number"
            min={1}
            max={MAX_QTY_PER_LINE}
            value={qty}
            onChange={(event) => setQty(Number(event.target.value))}
          />
        </label>
      </div>
      <button type="submit" disabled={add.isPending}>
        {add.isPending ? "Adding..." : "Add to cart"}
      </button>
      {add.isSuccess && (
        <p className="ok">
          Added. <Link href="/cart">View cart</Link>
        </p>
      )}
      {errorText && <p className="err" role="alert">{errorText}</p>}
    </form>
  );
}
