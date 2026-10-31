import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/docs/library";

/** "Folder > Tab > Page": where this page lives. Every level but the last is a link. */
export function DocBreadcrumb({ crumbs, className = "" }: { crumbs: Crumb[]; className?: string }) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="rounded-md transition-colors hover:text-ink hover:underline hover:underline-offset-4">{c.label}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-ink" : undefined}>{c.label}</span>
              )}
              {!last && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
