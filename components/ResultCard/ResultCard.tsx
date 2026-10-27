"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuizResult } from "@/types";
import { performanceRating, formatDuration } from "@/lib/wpmCalculator";

interface ResultCardProps {
  result: QuizResult;
  selectedWpm: number;
  actualWpm: number;
  readingDurationMs: number;
  /** Quiz taken without reading: the reading/speed rows do not apply. */
  quizOnly?: boolean;
  onRestart: () => void;
}

export function ResultCard({ result, selectedWpm, actualWpm, readingDurationMs, quizOnly = false, onRestart }: ResultCardProps) {
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
    ...(quizOnly
      ? []
      : ([
          ["Reading time", formatDuration(readingDurationMs)],
          ["Selected WPM", selectedWpm],
          ["Actual WPM", Math.round(actualWpm)],
        ] as [string, string | number][])),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl px-6 py-16">
      <div className="mb-8 text-center">
        <div className="mb-1 text-xs uppercase tracking-widest text-ink-muted">Performance</div>
        <div className={`font-display text-4xl ${ratingColor}`}>{rating}</div>
      </div>

      <Card>
        <dl className="divide-y divide-overlay/10">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Button size="lg" className="mt-8 w-full" onClick={onRestart}>
        Read another story
      </Button>
    </motion.div>
  );
}
