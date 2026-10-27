import type { ReactNode } from "react";

/**
 * PARALLEL ROUTES.
 * Each `@folder` next to this file is a SLOT. Next.js passes every slot to this layout as a
 * prop, next to the implicit `children` slot, and renders them in PARALLEL:
 *
 *   dashboard/
 *     layout.tsx           <- this file, receives { children, revenue, lowstock, activity }
 *     page.tsx             -> children
 *     @revenue/page.tsx    -> revenue
 *     @lowstock/page.tsx   -> lowstock
 *     @activity/page.tsx   -> activity
 *
 * Slots are NOT URL segments: all of these live at /dashboard.
 * Why bother? Each slot has its OWN loading.tsx and error.tsx, so a slow or broken panel
 * does not block or break the others, and each can have its own sub-routes.
 *
 * Rule from the docs: all slots at one level are either static or dynamic, never mixed.
 * The panels read live data, so the whole segment is dynamic.
 */
export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
  revenue: ReactNode;
  lowstock: ReactNode;
  activity: ReactNode;
};

export default function DashboardLayout({ children, revenue, lowstock, activity }: Props) {
  return (
    <>
      <h1>Seller dashboard</h1>
      {children}
      <div className="dash">
        <section className="panel" aria-label="Revenue" data-slot="revenue">
          {revenue}
        </section>
        <section className="panel" aria-label="Low stock" data-slot="lowstock">
          {lowstock}
        </section>
        <section className="panel panel-wide" aria-label="Activity" data-slot="activity">
          {activity}
        </section>
      </div>
    </>
  );
}
