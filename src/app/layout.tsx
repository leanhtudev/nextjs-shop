import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CartBadge } from "@/components/CartBadge";
import { TRPCReactProvider } from "@/trpc/client";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Refurb Shop", template: "%s | Refurb Shop" },
  description: "Example e-commerce site: ISR, SSR, Server Actions and tRPC in Next.js",
};

/**
 * PITFALL: do NOT read cookies()/headers() in this layout. A Dynamic API in a layout makes
 * EVERY page under it dynamic (SSR) and silently kills ISR. Anything personal (the cart count)
 * lives in a client island (<CartBadge />) that fetches through tRPC after the page loaded.
 */
export default function RootLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCReactProvider>
          <header className="nav">
            <Link href="/" className="brand">
              Refurb Shop
            </Link>
            <nav>
              <Link href="/products">
                Products <small>ISR</small>
              </Link>
              <Link href="/cart">
                Cart <CartBadge /> <small>SSR</small>
              </Link>
              <Link href="/dashboard">
                Dashboard <small>parallel routes</small>
              </Link>
            </nav>
          </header>
          <main className="page">{children}</main>
          {/* Parallel route slot (app/@modal): empty normally, the quick-view modal when intercepted. */}
          {modal}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
