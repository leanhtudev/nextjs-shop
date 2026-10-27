"use client";

import { useEffect, useState } from "react";

/**
 * Client island: shows how old the server-rendered HTML is, ticking every second.
 * A static (ISR) page cannot know "now", so anything that depends on the current
 * time or the current user belongs in a small client component like this one.
 */
export function PageAge({ since }: { since: string }) {
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setAge(Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);

  return <span className="age">{age === null ? "..." : `this HTML is ${age}s old`}</span>;
}
