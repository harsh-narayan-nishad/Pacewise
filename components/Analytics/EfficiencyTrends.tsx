"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PagerPill } from "@/components/Analytics/PagerPill";
import { BRAND_BLUE } from "@/lib/brand";
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
  const [slide, setSlide] = useState(0);

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

  const [label, value] = rows[Math.min(slide, rows.length - 1)];

  return (
    <section aria-label="Efficiency trends">
      <div className="mb-4 flex items-baseline justify-between gap-3 px-1">
        <h3 className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">Efficiency.</h3>
        <span className="shrink-0 text-sm sm:text-base" style={{ color: BRAND_BLUE }}>{trendLabel}</span>
      </div>
      <div className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-4 pb-8 pt-8 sm:px-10 sm:pt-12">
        <motion.div key={slide} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto max-w-xl text-center" aria-live="polite">
          <p className="font-display text-2xl leading-[1.15] tracking-[-0.03em] text-ink sm:text-4xl">{label}.</p>
          <p className="mt-1 font-display text-2xl leading-[1.15] tracking-[-0.03em] text-ink-muted [overflow-wrap:anywhere] sm:text-4xl">{value}</p>
        </motion.div>
        <dl className="mt-10 grid grid-cols-2 gap-x-4 gap-y-6 text-center sm:grid-cols-3">
          {rows.map(([l, v], i) => (
            <button key={l} type="button" onClick={() => setSlide(i)} className={`rounded-2xl px-2 py-3 transition-colors hover:bg-overlay/5 ${i === slide ? "bg-overlay/[0.06]" : ""}`}>
              <dd className="text-base font-medium text-ink sm:text-lg">{v}</dd>
              <dt className="mt-0.5 text-xs text-ink-muted">{l}</dt>
            </button>
          ))}
        </dl>
      </div>
      <PagerPill count={rows.length} index={slide} onSelect={setSlide} labels={rows.map(([l]) => l)} />
    </section>
  );
}
