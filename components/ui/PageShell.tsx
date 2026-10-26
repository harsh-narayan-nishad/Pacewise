import React from "react";

/** Consistent page frame for the account pages: display title + optional subtitle. */
export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="font-display text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">{title}</h1>
      {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}
