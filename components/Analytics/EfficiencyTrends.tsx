"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { storage, DailyActivity } from "@/lib/storage";
import { formatClock } from "@/lib/wpmCalculator";

/**
 * Aggregates the break/efficiency fields that `storage.recordSession`
 * writes into each DailyActivity row (see lib/storage.ts) into a handful
 * of readable trend numbers. Deliberately simple averages rather than a
 * full statistical model — "Reading Consistency" here is a heuristic
 * (100 minus the average WPM reduction) documented as such rather than a
 * rigorous variance-based score, which would need more historical
 * granularity than the current one-row-per-day schema stores.
 */
export function EfficiencyTrends() {
  const [days, setDays] = useState<DailyActivity[] | null>(null);

  useEffect(() => {
    const all = storage.getDailyActivity();
    setDays(Object.values(all).sort((a, b) => a.date.localeCompare(b.date)));
  }, []);

  if (!days) return null;
  const withBreaks = days.filter((d) => d.breakCount > 0);
  const withEfficiency = days.filter((d) => d.reductionPercentSamples > 0);

  if (withBreaks.length === 0 && withEfficiency.length === 0) return null;

  const avgDailyBreakMs = withBreaks.length ? withBreaks.reduce((s, d) => s + d.breakMs, 0) / withBreaks.length : 0;
  const avgBreakDurationMs = withBreaks.length
    ? withBreaks.reduce((s, d) => s + d.breakMs, 0) / withBreaks.reduce((s, d) => s + d.breakCount, 0)
    : 0;
  const avgEffectiveWpm = withEfficiency.length
    ? withEfficiency.reduce((s, d) => s + d.effectiveWpmSum / d.effectiveWpmSamples, 0) / withEfficiency.length
    : 0;
  const avgReduction = withEfficiency.length
    ? withEfficiency.reduce((s, d) => s + d.reductionPercentSum / d.reductionPercentSamples, 0) / withEfficiency.length
    : 0;
  const avgEfficiency = Math.max(0, 100 - avgReduction);
  const consistency = Math.max(0, Math.round(100 - avgReduction));

  // Trend: compare the most recent third of active days to the earliest
  // third, on reduction percent — a simple, explainable "is it improving"
  // signal without needing a proper regression.
  const chronological = withEfficiency;
  const third = Math.max(1, Math.floor(chronological.length / 3));
  const early = chronological.slice(0, third);
  const recent = chronological.slice(-third);
  const earlyAvg = early.reduce((s, d) => s + d.reductionPercentSum / d.reductionPercentSamples, 0) / early.length;
  const recentAvg = recent.reduce((s, d) => s + d.reductionPercentSum / d.reductionPercentSamples, 0) / recent.length;
  const trendDelta = earlyAvg - recentAvg; // positive = reduction is shrinking = improving
  const trendLabel =
    chronological.length < 3 ? "Not enough sessions yet" : trendDelta > 1 ? "Improving" : trendDelta < -1 ? "Declining" : "Stable";

  const rows: [string, string][] = [
    ["Daily total break time", formatClock(avgDailyBreakMs)],
    ["Average break duration", formatClock(avgBreakDurationMs)],
    ["Daily effective WPM", avgEffectiveWpm ? Math.round(avgEffectiveWpm).toString() : "—"],
    ["WPM reduction trend", `${avgReduction.toFixed(1)}% avg · ${trendLabel}`],
    ["Reading efficiency trend", `${Math.round(avgEfficiency)}/100 avg`],
    ["Reading consistency", `${consistency}/100`],
  ];

  return (
    <Card>
      <div className="mb-3 text-sm text-ink-muted">Efficiency trends</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="text-sm font-medium text-ink">{value}</div>
            <div className="text-xs text-ink-muted">{label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
