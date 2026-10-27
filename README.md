# Refurb Shop: an e-commerce example with ISR, SSR, Server Actions, tRPC and parallel routes

A small shop (product list, product page, cart, checkout, order confirmation) built to show **which Next.js
feature belongs where, and why**. Every page prints the time its HTML was generated, so you can see what is cached.

Stack: Next.js 16.4 (App Router), React 19, TypeScript, zod 4, tRPC 11 + TanStack Query 5, Jest 30 + React Testing Library.
Needs Node 20.9 or newer.

```bash
npm install
npm run preview     # next build && next start  ->  http://localhost:3000
npm test            # Jest + React Testing Library (9 suites, 54 tests)
```

Judge caching only in production mode. `npm run dev` re-renders every request, so nothing is cached there.
`npm run start:debug` logs cache activity. Every tRPC call is logged in the terminal (`[trpc] query product.list ok 4ms`).

## Pages and rendering

| Route | Rendering | Why |
|---|---|---|
| `/` | Static (SSG) | Never changes. |
| `/products` | ISR, 30 s | Same for everyone, changes now and then. Search box = tRPC query. |
| `/products/[id]` | ISR, 60 s + on-demand | Top 3 pre-built (`generateStaticParams`), the rest on first visit. Live stock island = tRPC query. |
| `/cart` | SSR + streaming | Depends on the visitor's cookie, needs live prices. Recommendations stream in via `<Suspense>`. |
| `/checkout` | SSR + Server Action | Per visitor, money involved. The form posts to a Server Action. |
| `/orders/[id]` | SSR + authorization | Private data. Only the browser that placed the order can read it. |
| `/dashboard` | Parallel routes (dynamic) | Three slots (`@revenue`, `@lowstock`, `@activity`) that stream and fail independently. |
| `/dashboard/orders` | Slot-only sub-route | Exists only in `@activity`. Shows soft vs hard navigation and `default.tsx`. |
| `/products/[id]` via a link | Parallel + intercepting route | Opens as a quick-view modal (`@modal`) over the current page. Reload or direct link shows the full page. |
| `/api/trpc/[trpc]` | Route Handler | The HTTP door of tRPC (batching, GET queries, POST mutations). |
| `/api/revalidate` | Route Handler | Webhook ("catalogue changed in the CMS") that triggers revalidation. |

`next build` prints `○ /products 30s`, `● /products/[id] 1m`, `ƒ /cart`, `ƒ /checkout`, `ƒ /orders/[id]`.

## Parallel and intercepting routes

Two examples, both live in the app.

```
src/app/
  layout.tsx                          receives { children, modal }
  @modal/                             SLOT: the quick-view modal
    default.tsx                       null = "no modal" (normal state, hard loads)
    [...catchAll]/page.tsx            null = closes the modal when navigating anywhere else
    (.)products/[id]/page.tsx         INTERCEPTS /products/[id] on soft navigation
  products/[id]/page.tsx              the real page (direct link, reload, SEO)
  dashboard/
    layout.tsx                        receives { children, revenue, lowstock, activity }
    page.tsx, default.tsx             the implicit `children` slot
    @revenue/   page, loading, error, default
    @lowstock/  page, loading, error, default
    @activity/  page, loading, error, default
      orders/page.tsx                 sub-route that exists ONLY in this slot -> /dashboard/orders
```

**What parallel routes are.** A folder starting with `@` is a **slot**. It is not a URL segment (`@revenue` adds nothing
to the URL). The parent layout receives each slot as a prop and renders them side by side. Each slot has its own
`loading.tsx`, `error.tsx` and sub-routes.

**Why use them**
- Independent streaming: a slow panel does not block the others.
- Independent failure: one broken panel does not take down the page.
- Slots can navigate on their own (`/dashboard/orders` changes only `@activity`).
- Conditional UI per layout (for example admin vs user), and modals with real URLs (with intercepting routes).

**Intercepting routes (`(.)`, `(..)`, `(...)`).** They match URL levels, not folders (the `@modal` folder does not count).
`@modal/(.)products/[id]` means: when the app navigates to `/products/[id]` with a `<Link>`, render this inside the
`@modal` slot and keep the current page behind it. A reload, a pasted link or a crawler gets the real page.

### What I observed (production build)

| Experiment | Result |
|---|---|
| Load `/dashboard` | Skeletons first, then revenue (about 0.8 s), low stock (about 1.5 s), activity (about 2.0 s). The server stamps in each panel differ by their delays. |
| `/dashboard?fail=activity` | Only the activity panel shows its error UI ("Try again" + a digest reference). Revenue and low stock render normally. |
| Click "All orders" (soft navigation) | URL becomes `/dashboard/orders`, only `@activity` changes. The revenue and low-stock stamps stay identical: those slots were **not** re-rendered. |
| Reload `/dashboard/orders` (hard navigation) | HTTP 200. Revenue and low stock render from their `default.tsx` with new stamps. Unknown URLs such as `/dashboard/nonsense` still return 404. |
| Click a product on `/products` | URL is `/products/1`, a dialog opens, the list is still on screen behind it. Escape and the browser Back button close it, Forward reopens it. |
| Reload while the modal is open, or open `/products/2` directly | No modal: the full ISR product page. |
| Click "View cart" inside the modal | Navigates to `/cart` and the modal is gone (thanks to the catch-all). |
| Click a low-stock product on the dashboard | The same modal opens over the **dashboard**. Add to cart works inside it, Escape returns to `/dashboard`. |

### Rules and gotchas

- **Every named slot needs `default.tsx`** in this Next.js version. I removed `@revenue/default.tsx` to check: the build
  failed with "Parallel route slots cannot render the same URLs ... `/dashboard/orders` is missing a matching page or
  default.tsx in `@revenue`". `children` is a slot too and needs its own `default.tsx` when a sub-route exists only in a slot.
- **Soft vs hard navigation.** Soft (client-side): slots that do not match the new URL keep their previous content.
  Hard (reload, first visit): they cannot, so Next renders `default.tsx` (or fails). That difference is the main source of bugs.
- **Closing a modal.** `router.back()` for the close button, Escape and the backdrop. A `<Link>` to another page needs a
  catch-all slot that returns `null`, otherwise the unmatched modal slot stays on screen.
- **All slots at one level are either static or dynamic.** The dashboard is `force-dynamic` because its panels read live data.
- **Every slot runs on the server, whatever the layout displays.** If a layout picks `admin` or `user` by role, both slots
  still execute and are in the response. Authorize inside each slot or in your data access layer. This demo dashboard
  has no login and shows only aggregates, never customer data.
- **Keep the modal shell and its content apart.** `Modal` is a small client component; the content stays a Server Component
  passed as children (here it still uses client islands for live stock and add-to-cart).
- **Accessibility.** The modal labels the dialog, focuses it, closes on Escape and locks scroll, but does not trap Tab focus.
  Use `<dialog>` or a headless UI library for a complete solution.
- **`error.tsx` must be a client component**; the shared `SlotError` shows the digest, not the raw message, because
  production hides server error messages from the browser.

## The purchase flow, step by step

1. **Product page** is a cached ISR page. After it loads, two client queries go out as **one batched request**
   (`GET /api/trpc/cart.count,product.liveStock`): the header count and the live stock. The page may be 60 s old; the
   live stock is not.
2. **Add to cart** is a typed tRPC mutation. It validates input (zod), re-checks live stock, and writes an HttpOnly
   cookie holding only ids and quantities. Errors come back typed: `BAD_REQUEST` with field errors, or `CONFLICT`
   ("Only 3 in stock").
3. **Cart** is SSR. The server prefetches the cart through tRPC, hydrates it into React Query, and the client cart starts
   with data (no spinner). Changing a quantity is **optimistic**: the UI reacts at once and rolls back if the server refuses.
4. **Checkout** is SSR with a form posting to a **Server Action**. It validates, builds the real totals from the database,
   decrements stock and creates the order all-or-nothing, remembers the order in a cookie, clears the cart, calls
   `updateTag()` so product pages show the new stock, and redirects.
5. **Order page** asks `order.byId`. A middleware checks that this browser owns the order; anyone else gets a 404.

## tRPC: the important things, and where to see them

| Idea | What it gives you | Where |
|---|---|---|
| End-to-end types | Clients import only `type AppRouter`. Input, output and errors are checked by the compiler. No codegen, no DTO drift. | `src/server/routers/_app.ts`, `src/trpc/client.tsx` |
| Routers and procedures | Queries (read, GET) and mutations (write, POST) grouped by domain. | `src/server/routers/*.ts` |
| Input validation | Every procedure's input is a zod schema; bad input never reaches your code. | `.input(...)` in each router |
| Context | Per-request object (`ctx`). Ours is **lazy** and an interface, so ISR pages can call tRPC and unit tests can fake it. | `src/server/context.ts` |
| Middleware | Reusable wrappers: logging, rate limiting, ownership check. | `src/server/trpc.ts`, `src/server/routers/order.ts` |
| Procedure bases | `publicProcedure`, `mutationProcedure` (+ rate limit), `ownedOrderProcedure`. Pick the one that matches the security need. | `src/server/trpc.ts` |
| Error model | `TRPCError` codes map to HTTP (`NOT_FOUND` 404, `CONFLICT` 409, `TOO_MANY_REQUESTS` 429). Zod issues arrive as `error.data.zodError`. | `errorFormatter` in `trpc.ts`, `AddToCart.tsx` |
| Server caller | Call procedures as plain functions in Server Components: same validation and middleware, no HTTP hop. Never `fetch()` your own API from a Server Component. | `src/server/caller.ts` |
| Prefetch + hydrate | Server prefetches into a QueryClient, client components start with that data. | `src/trpc/server.tsx`, `src/app/cart/page.tsx` |
| Client hooks | `useQuery`/`useMutation` with typed options, auto batching, refetch on focus and interval. | `LiveStock.tsx`, `AddToCart.tsx`, `SearchBox.tsx` |
| Optimistic updates | `onMutate` (cancel, snapshot, apply) / `onError` (rollback) / `onSettled` (refetch). | `CartView.tsx`, pure helper `applyQuantity` in `pricing.ts` |
| Testing without HTTP | `createCallerFactory(appRouter)` with a fake context. | `__tests__/routers.test.ts` |

### tRPC vs Server Actions vs Route Handlers (what this project does)

| Use | For | Here |
|---|---|---|
| **tRPC** | Interactive client state: typed queries and mutations, caching, optimistic UI, batching. | cart, live stock, search, header count |
| **Server Action** | Form submits and flows that end in `redirect()` or cache invalidation (`updateTag`). Work without client JS. | checkout |
| **Route Handler** | Public or third-party HTTP endpoints: webhooks, OAuth callbacks, files. | `/api/revalidate`, the tRPC adapter |
| **Direct function call** | Server Components reading data. | ISR pages call the cached readers through the server caller |

Both tRPC and the Server Action are thin transport layers. The rules live in shared code (`db.ts`, `pricing.ts`,
`checkout-schema.ts`), which is why they are easy to test.

Honest trade-offs of tRPC: it assumes a TypeScript client and server in the same repo, it is not a public REST API
(use REST/OpenAPI for third parties and mobile apps in other languages), and it adds a client cache layer you must understand.

## Experiments (results from running this build)

1. **ISR through tRPC stays ISR.** `/products` and `/products/[id]` return `x-nextjs-cache: HIT`. `/products/5` is `MISS`
   once, then `HIT`. `/products/99` is a real 404. This works because the tRPC context is lazy (never reads cookies for `product.*`).
2. **Batching.** Open the Network tab on a product page: one request, `cart.count,product.liveStock?batch=1`.
3. **Cached page vs live truth.** Place an order, then look at the product page: the cached block and the "Live:" line
   can differ until the cache is refreshed. The cart always uses live values.
4. **SSR + streaming.** `curl -w "%{time_starttransfer} %{time_total}"` on `/cart`: first byte about 0.27 s, full response
   about 1.2 s. The slow recommendations did not block the cart.
5. **Validation.** `POST /api/trpc/cart.add` with `qty: 0` returns HTTP 400 and
   `data.zodError.fieldErrors.qty`. With `productId: "4", qty: 4` it returns 409 "Only 3 in stock."
6. **Optimistic update.** With the server delayed by 1.5 s, the UI showed the new quantity after 77 ms. When the server
   answered 409, the quantity went back and the message appeared.
7. **Invalidation after checkout.** Buying 3 of product 1: the next visit is `MISS` and shows the lower stock
   (`updateTag`), the visit after is `HIT`.
8. **Concurrency.** Two buyers, 2 units each, 3 in stock: one order is placed, the other gets "only 1 left". Stock never goes negative.
9. **Authorization.** The order URL returns 200 for the browser that placed it and 404 for any other browser.
10. **No JavaScript.** With JS disabled the checkout still works (plain form POST to the Server Action).
11. **Webhook.**
    ```bash
    curl -X POST http://localhost:3000/api/revalidate \
      -H 'content-type: application/json' -H 'x-webhook-secret: demo-secret' \
      -d '{"id":"2","price":300}'
    ```
    Wrong secret: 401. Right secret: the product page is served `STALE` once, then `HIT` with the new price.

## Gotchas found while building this (worth remembering)

- **tRPC swallows Next.js's "this route is dynamic" signal.** Reading `cookies()` throws an internal error that Next uses to
  switch a route to SSR. tRPC catches it and rethrows `INTERNAL_SERVER_ERROR`, so Next never sees it. At build time that
  failed `/checkout`, and `prefetchQuery` swallows errors too, so the cart page could have been prerendered as static with
  an empty cart. Fix: `await connection()` at the top of every SSR page that uses cookies through tRPC.
- **A cookie in the layout kills ISR for every page under it.** The header count is a client island for that reason.
- **Make the context lazy.** Creating the context must not touch `cookies()`/`headers()`, otherwise every page that
  calls tRPC becomes dynamic.
- **React 19 resets uncontrolled forms after a Server Action.** The action echoes the typed values back and the inputs use
  `defaultValue`. A `<select>` ignores a changed `defaultValue` after mount, so it needs a `key` (a Jest test caught this).
- **Prices never come from the client or the cookie.** The cart cookie holds ids and quantities only. Totals are computed
  on the server from the database, in integer cents.
- **Two caches in ISR.** The page window (`revalidate`) and the Data Cache (`unstable_cache`) are aligned on purpose.
- **`cacheComponents` is off** (see `next.config.ts`). New Next.js 16 projects enable it by default; it replaces
  `unstable_cache` and route segment options with `"use cache"`. This project teaches the classic model first.

## Security checklist applied

- Every tRPC procedure and Server Action is a **public HTTP endpoint**. Hiding a button protects nothing.
- Input validated with zod on the server (body, cookies, form data). Unknown fields are dropped.
- **Authorization in the procedure** (`ownedOrderProcedure`), answering `NOT_FOUND` instead of `FORBIDDEN` (no id probing). Classic IDOR / broken access control (OWASP #1).
- **Idempotency key** on checkout: a double click or a retry creates one order.
- **Atomic stock check and decrement**, all or nothing. In a real database: a transaction or `UPDATE ... WHERE stock >= qty`.
- **Rate limiting** middleware on mutations (30 per 10 s per client and procedure).
- Cookies: `HttpOnly`, `SameSite=Lax` (set `COOKIE_SECURE=1` behind HTTPS). Webhook secret compared in constant time.
- Private page marked `noindex`. No card data is collected: the checkout is a demo.

## Tests (Jest + React Testing Library)

`npm test` runs 9 suites, 54 tests:

- `pricing.test.ts`: totals, free-shipping boundary, VAT in integer cents, optimistic `applyQuantity`.
- `checkout-schema.test.ts`: valid and invalid forms, unknown fields dropped.
- `rate-limit.test.ts`: window, retry-after, separate keys (injected clock).
- `db.test.ts`: no overselling under concurrency, idempotent replay, all-or-nothing, price snapshot, order listing for the dashboard.
- `routers.test.ts`: tRPC procedures through `createCaller` with a fake context (validation codes, `CONFLICT`, ownership, rate limit).
- `checkout-action.test.ts`: the Server Action with `redirect`, `updateTag` and the context mocked.
- `CheckoutForm.test.tsx`: RTL on the client form: submitted data, field errors from the server, kept values, pending state.
- `Modal.test.tsx`: RTL on the intercepted-route modal shell: dialog role and focus, close button, Escape, backdrop vs inside clicks, scroll lock (router mocked).
- `SlotError.test.tsx`: RTL on a slot's error UI: alert, digest shown, raw message hidden, `reset()` called.

Notes: `server-only` is stubbed in `jest.config.mjs`; `unstable_cache` and `next/cache` are mocked in server tests.

## Demo shortcuts that are NOT production practice

- In-memory "database" (resets on restart; `next build` and `next start` are separate processes).
- No real payment. A real checkout creates the order as "pending", redirects to the payment provider, and confirms the
  order from the provider's signed **webhook**, never from the browser.
- Webhook secret default (`demo-secret`, override with `REVALIDATE_SECRET`). Order ids and the cart live in cookies.
- Rate limiter and cache are per process. With several containers (ECS/EKS) use a shared cache handler for ISR and a
  shared store (Redis) or edge limits for rate limiting.

## Ideas to extend it

1. Replace the in-memory db with Postgres (Prisma or Drizzle) and wrap `dbCreateOrder` in a transaction.
2. Add `responseMeta` to cache public tRPC queries at the CDN.
3. Add a superjson transformer (for `Date`, `Map`) and a Playwright end-to-end test of the purchase flow.
4. Port the caching to Cache Components (`"use cache"`, `cacheTag`, `cacheLife`).
5. Protect `/dashboard` with real authentication (an `adminProcedure` in tRPC, checked inside every slot) and add a conditional slot per role.

> `AGENTS.md` was generated by `create-next-app`; it tells coding agents to read the docs bundled in
> `node_modules/next/dist/docs/`, because Next.js 16 differs from older training data.
