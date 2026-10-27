"use client";

import React, { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  count: number;
  index: number;
  onSelect: (i: number) => void;
  /** Names for the dots, read by screen readers. */
  labels: string[];
  /** Milliseconds between automatic steps while playing. */
  intervalMs?: number;
  className?: string;
}

/**
 * The pill of dots + round play button under a showcase card (as on apple.com's "Get the highlights"):
 * the long dot is the current slide, clicking a dot jumps there, and the button starts / pauses auto-advance.
 * Starts paused when the person prefers reduced motion.
 */
export function PagerPill({ count, index, onSelect, labels, intervalMs = 4000, className }: Props) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!playing || count < 2) return;
    const t = window.setTimeout(() => onSelect((index + 1) % count), intervalMs);
    return () => window.clearTimeout(t);
  }, [playing, index, count, intervalMs, onSelect]);

  return (
    <div className={cn("mt-5 flex items-center justify-center gap-3", className)}>
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
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pause" : "Play"}
        className="grid h-12 w-12 place-items-center rounded-full bg-overlay/[0.08] text-ink backdrop-blur-sm transition-colors hover:bg-overlay/15"
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
      </button>
    </div>
  );
}
