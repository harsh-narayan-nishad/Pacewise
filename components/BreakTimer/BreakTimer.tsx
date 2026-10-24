"use client";

import React from "react";
import { motion } from "framer-motion";
import { Coffee, TrendingDown } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { formatClock } from "@/lib/wpmCalculator";

interface BreakTimerProps {
  currentBreakMs: number;
  todayBreakMs: number;
  reductionPercent: number;
}

/**
 * The floating "Reading Paused" card. Deliberately dumb: it receives
 * already-computed numbers (from useBreakTracker + the reduction math in
 * lib/wpmCalculator) rather than owning any timers itself, consistent
 * with the app's "components render, hooks orchestrate" rule.
 *
 * Callers are responsible for placement — on large screens this docks in
 * the reserved Speedometer gutter (so it can never overlap the story
 * text, by construction); on small screens the caller centers it as a
 * lightweight modal-style card instead, since there's no reserved column
 * to dock into.
 */
export function BreakTimer({ currentBreakMs, todayBreakMs, reductionPercent }: BreakTimerProps) {
  const showReductionHint = reductionPercent >= 1;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="w-56 rounded-2xl border border-overlay/10 bg-canvas-raised/80 p-3.5 text-center shadow-themed backdrop-blur-xl"
    >
      <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-medium text-ink">
        <Coffee className="h-3.5 w-3.5 text-accent-fast" />
        Reading Paused
      </div>
      <div className="mb-1 font-mono text-xl tabular-nums text-ink">{formatClock(currentBreakMs)}</div>
      <div className="text-[11px] text-ink-muted">
        Total break today: <span className="font-mono text-ink-muted">{formatClock(todayBreakMs)}</span>
      </div>

      {showReductionHint && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2.5 flex items-center justify-center gap-1.5 overflow-hidden rounded-full bg-accent-fast/10 px-2.5 py-1 text-[11px] text-accent-fast"
        >
          <motion.span animate={{ y: [0, -1.5, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <TrendingDown className="h-3 w-3" />
          </motion.span>
          <span>
            Pace reduced by <AnimatedNumber value={reductionPercent} decimals={1} suffix="%" className="font-semibold tabular-nums" />
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
