"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal shell for an INTERCEPTED route. Closing = going back in history (router.back()),
 * so the URL, the browser back button and the modal always agree.
 *
 * Kept separate from the modal CONTENT on purpose: the content stays a Server Component
 * (passed in as children), only this thin shell is a client component.
 *
 * Not a complete accessibility solution: it labels the dialog, moves focus into it, closes on Escape
 * and locks page scroll, but it does not trap Tab focus. Use <dialog> or a headless UI library for that.
 */
export function Modal({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [router]);

  return (
    <div className="modal-backdrop" onClick={() => router.back()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="modal"
        onClick={(event) => event.stopPropagation()} // clicks inside must not reach the backdrop
      >
        <button type="button" className="secondary modal-close" aria-label="Close" onClick={() => router.back()}>
          &times;
        </button>
        {children}
      </div>
    </div>
  );
}
