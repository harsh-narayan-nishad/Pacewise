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
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Reading efficiency</span>
          <span className="rounded-full bg-accent-medium/15 px-3 py-1 text-xs font-semibold text-accent-medium">
            Score {score}/100
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-overlay/10 bg-canvas/40 p-3">
              <div className="font-mono text-lg text-ink">{value}</div>
              <div className="text-xs text-ink-muted">{label}</div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-ink-muted">{summary}</p>
      </Card>
    </motion.div>
  );
}
