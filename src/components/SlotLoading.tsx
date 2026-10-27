/** Skeleton used by each slot's loading.tsx. Shown while THAT slot streams, nothing else waits. */
export function SlotLoading({ title }: { title: string }) {
  return (
    <div aria-busy="true">
      <h2>{title}</h2>
      <div className="skeleton" />
      <div className="skeleton skeleton-short" />
      <small className="muted">Loading {title.toLowerCase()}...</small>
    </div>
  );
}
