"use client";

import React, { useEffect } from "react";

/** Route-level error boundary: a render error shows this instead of a blank screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl text-ink">Something went wrong</h1>
      <p className="max-w-md text-sm text-ink-muted">An unexpected error stopped this page from loading. Your saved progress is safe.</p>
      <button onClick={reset} className="rounded-full bg-ink px-5 py-2 text-sm text-canvas transition-opacity hover:opacity-90">
        Try again
      </button>
    </main>
  );
}
