import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (avoids timing attacks on secrets). */
export function safeEqual(a: string, b: string): boolean {
  // Hash first so both buffers have the same length (timingSafeEqual requires it).
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
