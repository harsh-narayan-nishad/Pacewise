"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { QuizResult } from "@/types";
import { performanceRating, formatDuration } from "@/lib/wpmCalculator";
import { BRAND_BLUE } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";

interface ResultCardProps {
  result: QuizResult;
  selectedWpm: number;
  actualWpm: number;
  readingDurationMs: number;
  /** Quiz taken without reading: the reading/speed rows do not apply. */
  quizOnly?: boolean;
  /** When the test was started (ms since epoch). */
  quizStartedAt?: number | null;
  onRestart: () => void;
}

/** The score as one large tile (apple.com home-page style): rating, a line of copy, two pills, then every number. */
export function ResultCard({ result, selectedWpm, actualWpm, readingDurationMs, quizOnly = false, quizStartedAt = null, onRestart }: ResultCardProps) {
  const rating = performanceRating(result.accuracy);
  const ratingColor =
    rating === "Excellent" ? "text-accent-medium" : rating === "Good" ? "text-accent-slow" : rating === "Average" ? "text-accent-fast" : "text-accent-extreme";

  const rows: [string, string | number][] = [
    ["Total questions", result.total],
    ["Correct", result.correct],
    ["Wrong", result.wrong],
    ["Skipped", result.skipped],
    ["Accuracy", `${result.accuracy.toFixed(0)}%`],
    ["Avg time / question", formatDuration(result.avgTimePerQuestionMs)],
    ["Total test time", formatDuration(result.totalTimeMs)],
    ...(quizStartedAt ? ([["Test started", new Date(quizStartedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })]] as [string, string][]) : []),
    ...(quizOnly
      ? []
      : ([
          ["Reading time", formatDuration(readingDurationMs)],
          ["Selected WPM", selectedWpm],
          ["Actual WPM", Math.round(actualWpm)],
        ] as [string, string | number][])),
  ];

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-5 pb-8 pt-10 text-center sm:px-10 sm:pt-14">
      <div className="text-sm uppercase tracking-[0.18em] text-ink-muted">Performance</div>
      <h1 className={`mt-2 font-display text-5xl leading-[1.05] tracking-[-0.03em] sm:text-7xl ${ratingColor}`}>{rating}.</h1>
      <p className="mt-3 text-lg text-ink sm:text-xl">
        {result.correct} of {result.total} correct · {result.accuracy.toFixed(0)}% accuracy
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onRestart} className="rounded-full px-6 py-2.5 text-base text-white transition-opacity hover:opacity-90" style={{ background: BRAND_BLUE }}>
          Read another story
        </button>
        <Link href={ROUTES.history} className="rounded-full border px-6 py-2.5 text-base transition-colors hover:bg-overlay/5" style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}>
          Past test attempts
        </Link>
      </div>

      <dl className="mt-10 grid grid-cols-2 gap-3 text-left sm:grid-cols-3 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-overlay/10 bg-canvas px-4 py-4">
            <dd className="font-display text-3xl leading-none tracking-[-0.03em] text-ink">{value}</dd>
            <dt className="mt-2 text-sm text-ink-muted">{label}</dt>
          </div>
        ))}
      </dl>
    </motion.section>
  );
}
