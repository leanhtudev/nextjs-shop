"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { eur } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

/** Search-as-you-type: debounced input -> typed tRPC query. Nothing is sent while the box is empty. */
export function SearchBox() {
  const trpc = useTRPC();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useQuery(trpc.product.search.queryOptions({ q: debounced }, { enabled: debounced.length > 0 }));

  return (
    <div className="search">
      <label>
        Search products
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="try: phone, tablet" />
      </label>
      {debounced.length > 0 && results.isFetching && <small className="muted">Searching...</small>}
      {results.data && (
        <ul>
          {results.data.length === 0 && <li className="muted">No matches</li>}
          {results.data.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`}>{p.name}</Link> <span className="muted">{eur(p.priceCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
