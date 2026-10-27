import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dbUpdateProduct } from "@/lib/db";
import { safeEqual } from "@/lib/security";

/**
 * Webhook: "the catalogue changed elsewhere (CMS, ERP), refresh the cached pages".
 *
 *   curl -X POST http://localhost:3000/api/revalidate \
 *     -H 'content-type: application/json' -H 'x-webhook-secret: demo-secret' \
 *     -d '{"id":"1","price":299}'
 *
 * Route Handlers use revalidateTag(tag, "max") (stale-while-revalidate).
 * updateTag() is Server Actions only.
 */
const BodySchema = z
  .object({
    id: z.string().min(1).max(20),
    price: z.number().min(1).max(5000).optional(), // euros
    stock: z.number().int().min(0).max(1000).optional(),
  })
  .refine((b) => b.price !== undefined || b.stock !== undefined, "Send price and/or stock");

export async function POST(req: Request) {
  // Constant-time comparison; the secret never appears in a URL or a log line.
  const secret = req.headers.get("x-webhook-secret") ?? "";
  if (!safeEqual(secret, process.env.REVALIDATE_SECRET ?? "demo-secret")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { id, price, stock } = parsed.data;
  const product = await dbUpdateProduct(id, {
    ...(price !== undefined && { priceCents: Math.round(price * 100) }),
    ...(stock !== undefined && { stock }),
  });
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 404 });

  revalidateTag(`product-${id}`, "max");
  revalidateTag("products", "max");
  return NextResponse.json({
    revalidated: true,
    tags: [`product-${id}`, "products"],
    note: "Marked stale. The next request is served stale and rebuilds in the background; the one after is fresh.",
    product,
  });
}
