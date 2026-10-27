/**
 * default.tsx = "what to render for this slot when Next.js cannot recover its state".
 * `children` is a slot too. On a full page load of /dashboard/orders there is no
 * dashboard/orders/page.tsx, so without this file the whole route would 404.
 */
export { default } from "./page";
