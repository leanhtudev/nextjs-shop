import type { ReactNode } from "react";
import { PageAge } from "./PageAge";

type Props = {
  mode: "ISR" | "SSR";
  children?: ReactNode;
};

/**
 * Server Component. `new Date()` runs when the HTML is GENERATED:
 *  - on an ISR page that is at build time / at each background regeneration,
 *  - on an SSR page it is on every single request.
 * Reload the page: if the timestamp does not change, you got a cached page.
 */
export function RenderBadge({ mode, children }: Props) {
  const renderedAt = new Date().toISOString();
  return (
    <aside className={`badge ${mode === "ISR" ? "badge-isr" : "badge-ssr"}`}>
      <div className="badge-row">
        <strong>{mode === "ISR" ? "ISR (static + regenerated)" : "SSR (rendered per request)"}</strong>
        <PageAge since={renderedAt} />
      </div>
      <div>
        HTML generated at <time dateTime={renderedAt}>{renderedAt}</time>
      </div>
      {children}
      {process.env.NODE_ENV !== "production" && (
        <div className="warn">
          Dev mode: every request re-renders, so ISR is NOT active here. Run <code>npm run build &amp;&amp; npm start</code>.
        </div>
      )}
    </aside>
  );
}
