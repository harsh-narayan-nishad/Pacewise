import React from "react";

/** Consistent page frame for the account pages: display title + optional subtitle. */
export function PageShell({ title, subtitle, wide = false, children }: { title: string; subtitle?: string; /** Use the site-wide content width (as on the home page) for chart-heavy pages. */ wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "mx-auto max-w-6xl px-4 py-14 sm:px-8" : "mx-auto max-w-3xl px-6 py-14"}>
      <h1 className="font-display text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">{title}</h1>
      {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}
