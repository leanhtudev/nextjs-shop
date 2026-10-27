/** Shows WHEN a slot was rendered on the server, so independent streaming is visible. */
export function SlotStamp({ name }: { name: string }) {
  const time = new Date().toISOString().slice(11, 23);
  return (
    <small className="muted stamp">
      {name} slot rendered at {time} UTC
    </small>
  );
}
