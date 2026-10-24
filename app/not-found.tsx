import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl text-ink">Page not found</h1>
      <p className="max-w-md text-sm text-ink-muted">That page doesn&apos;t exist or has moved.</p>
      <Link href="/" className="rounded-full bg-ink px-5 py-2 text-sm text-canvas transition-opacity hover:opacity-90">
        Back to home
      </Link>
    </main>
  );
}
