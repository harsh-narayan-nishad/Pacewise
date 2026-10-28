"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface Props {
  count: number;
  index: number;
  onSelect: (i: number) => void;
  /** Names for the dots, read by screen readers. */
  labels: string[];
  className?: string;
}

/**
 * The pill of dots under a showcase card (as on apple.com's "Get the highlights"): the long dot is the
 * current slide and clicking a dot jumps there. No auto-advance, so there is nothing to pause.
 */
export function PagerPill({ count, index, onSelect, labels, className }: Props) {
  return (
    <div className={cn("mt-5 flex items-center justify-center", className)}>
      <div role="tablist" aria-label="Slides" className="flex h-12 items-center gap-3 rounded-full bg-overlay/[0.08] px-6 backdrop-blur-sm">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            role="tab"
            type="button"
            aria-selected={i === index}
            aria-label={labels[i] ?? `Slide ${i + 1}`}
            onClick={() => onSelect(i)}
            className="grid h-6 place-items-center"
          >
            <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === index ? "w-8 bg-ink-muted" : "w-1.5 bg-ink-faint hover:bg-ink-muted")} />
          </button>
        ))}
      </div>
    </div>
  );
}
