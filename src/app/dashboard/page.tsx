import type { Metadata } from "next";
import Link from "next/link";
import { RenderBadge } from "@/components/RenderBadge";

export const metadata: Metadata = { title: "Dashboard" };

/** This is the implicit `children` slot of the dashboard layout. */
export default function DashboardPage() {
  return (
    <>
      <RenderBadge mode="SSR" />
      <p>
        The three panels below are <strong>parallel routes</strong> (<code>@revenue</code>, <code>@lowstock</code>,{" "}
        <code>@activity</code>). Reload and watch them appear one by one: each streams on its own.
      </p>
      <p>
        <Link href="/dashboard?fail=activity">Make the activity panel fail</Link> (the others keep working) ·{" "}
        <Link href="/dashboard">Back to normal</Link> · <Link href="/dashboard/orders">All orders</Link> (only the
        activity panel changes)
      </p>
      <p className="muted">
        Demo only: this page has no login. It shows aggregates and order totals, never customer data. A real dashboard
        needs authentication and authorization inside every slot, because every slot runs on the server whatever the
        layout chooses to display.
      </p>
    </>
  );
}
