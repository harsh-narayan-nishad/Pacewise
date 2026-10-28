"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { BreakStats } from "@/types";
import { formatClock, readingEfficiencyScore, readingEfficiencySummary } from "@/lib/wpmCalculator";

interface ReadingEfficiencyReportProps {
  selectedWpm: number;
  effectiveWpm: number;
  reductionPercent: number;
  activeReadingMs: number;
  totalSessionMs: number;
  breakStats: BreakStats;
}

export function ReadingEfficiencyReport({
  selectedWpm,
  effectiveWpm,
  reductionPercent,
  activeReadingMs,
  totalSessionMs,
  breakStats,
}: ReadingEfficiencyReportProps) {
  const score = readingEfficiencyScore(reductionPercent);
  const summary = readingEfficiencySummary(reductionPercent, breakStats.breakCount);

  const stats: [string, string][] = [
    ["Selected WPM", `${Math.round(selectedWpm)}`],
    ["Effective WPM", `${Math.round(effectiveWpm)}`],
    ["WPM reduced by", `${reductionPercent.toFixed(1)}%`],
    ["Total break time", formatClock(breakStats.totalBreakMs)],
    ["Number of breaks", `${breakStats.breakCount}`],
    ["Longest break", formatClock(breakStats.longestBreakMs)],
    ["Average break", formatClock(breakStats.averageBreakMs)],
    ["Active reading time", formatClock(activeReadingMs)],
    ["Total session time", formatClock(totalSessionMs)],
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-[32px] bg-canvas-raised px-5 pb-8 pt-8 sm:px-10 sm:pt-12">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-4xl">Reading efficiency.</h2>
          <span className="rounded-full bg-accent-medium/15 px-4 py-1.5 text-sm font-medium text-accent-medium">
            Score {score}/100
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-overlay/10 bg-canvas px-4 py-4">
              <div className="font-display text-3xl leading-none tracking-[-0.03em] text-ink">{value}</div>
              <div className="mt-2 text-sm text-ink-muted">{label}</div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-base text-ink-muted">{summary}</p>
      </Card>
    </motion.div>
  );
}
