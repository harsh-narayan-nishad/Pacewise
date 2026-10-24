"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number; // 1-indexed
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}

/** Small, reusable prev/next + page-number control — shared by every
 *  paginated list in the app (Past Test Attempts, Search History) so they
 *  all look and behave the same way. Renders nothing for a single page,
 *  since there's nothing to paginate. */
export function Pagination({ page, pageCount, onChange, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1
  );

  return (
    <div className={`flex items-center justify-center gap-1 ${className ?? ""}`}>
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-xs text-ink-faint">…</span>}
          <button
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-medium transition-colors ${
              p === page ? "bg-ink text-canvas" : "text-ink-muted hover:bg-overlay/5 hover:text-ink"
            }`}
          >
            {p}
          </button>
        </React.Fragment>
      ))}
      <button
        onClick={() => onChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        aria-label="Next page"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
