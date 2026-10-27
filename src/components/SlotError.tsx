"use client";

/**
 * Error UI for ONE slot. Used by each slot's error.tsx (error boundaries must be client components).
 * Only this panel is replaced: the other slots, the layout and the nav keep working.
 */
export function SlotError({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="slot-error">
      <h2>{title}</h2>
      <p className="err">This panel could not be loaded.</p>
      {/* In production the real message is hidden from the browser; the digest links to the server log. */}
      {error.digest && <p className="muted">Reference: {error.digest}</p>}
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
