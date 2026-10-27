"use client";

import { SlotError } from "@/components/SlotError";

export default function ActivityError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SlotError title="Recent activity" {...props} />;
}
