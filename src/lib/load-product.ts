import "server-only";
import { TRPCError } from "@trpc/server";
import { serverApi } from "@/server/caller";

/**
 * Shared by the full product page and the quick-view modal (an intercepting route).
 * Unknown id or invalid id both mean "no such product": return null instead of throwing.
 */
export async function loadProduct(id: string) {
  try {
    return await serverApi().product.byId({ id });
  } catch (error) {
    if (error instanceof TRPCError && (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")) return null;
    throw error;
  }
}
