"use client";

import React from "react";
import { formatDuration } from "@/lib/wpmCalculator";

interface ProgressBarProps {
  progress: number; // 0..1
  wordsRemaining: number;
  msRemaining: number;
  currentParagraph: number;
  totalParagraphs: number;
  /** Overrides the "Paragraph X / Y" label's noun — used for an uploaded
   *  PDF/image story, counted in pages rather than paragraphs (see
   *  app/reader/page.tsx). Defaults to "Paragraph" so every existing
   *  caller renders exactly as before. */
  unitLabel?: string;
}

/**
 * Docked directly under TopNav (`top-14` = TopNav's own height). Plain,
 * fully opaque surface (`bg-canvas-raised`, no glass) — unlike TopNav,
 * this bar sits directly above the reading content and needs to stay
 * crisply legible against whatever's scrolling underneath it, so it
 * deliberately does NOT use GlassSurface. Sticky-feeling via `fixed`
 * (there's no real page scroll to stick against here, since the reading
 * track scrolls via transform, not native scroll — see useReadingEngine —
 * so `fixed` achieves the same "always visible" result without a scroll
 * container to attach a `sticky` position to).
 */
export function ProgressBar({
  progress,
  wordsRemaining,
  msRemaining,
  currentParagraph,
  totalParagraphs,
  unitLabel = "Paragraph",
}: ProgressBarProps) {
  return (
    <div
      className="fixed left-0 right-0 top-14 z-20 border-b border-overlay/10 bg-canvas-raised shadow-themed"
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="mx-auto max-w-3xl px-4 py-2.5 sm:px-8">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span aria-live="polite">
            {unitLabel} {Math.min(currentParagraph + 1, totalParagraphs)} / {totalParagraphs}
          </span>
          <span className="font-mono text-ink">{Math.round(progress * 100)}%</span>
          <span>
            {wordsRemaining} words · {formatDuration(msRemaining)} left
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-overlay/10">
          <div
            className="h-full rounded-full bg-accent-medium transition-[width] duration-150 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
