"use client";

import { SlotError } from "@/components/SlotError";

export default function LowStockError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SlotError title="Low stock" {...props} />;
}
