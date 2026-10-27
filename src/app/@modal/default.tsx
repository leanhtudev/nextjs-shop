/**
 * PARALLEL + INTERCEPTING ROUTES: the @modal slot.
 *
 * default.tsx returns null: "no modal" is the normal state, also on a full page load.
 *
 *   app/@modal/default.tsx                    -> no modal
 *   app/@modal/(.)products/[id]/page.tsx      -> modal, only when navigating to /products/[id]
 *                                               from inside the app (soft navigation)
 *   app/@modal/[...catchAll]/page.tsx         -> closes the modal when navigating anywhere else
 *   app/products/[id]/page.tsx                -> the real page: direct link, reload, search engines
 */
export default function Default() {
  return null;
}
