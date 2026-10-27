"use client";

import { SlotError } from "@/components/SlotError";

export default function RevenueError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SlotError title="Revenue" {...props} />;
}
