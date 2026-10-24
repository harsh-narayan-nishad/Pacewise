"use client";

import React from "react";
import { Check, X, MinusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { QuestionAnswer, StoryQuestion } from "@/types";
import { formatDuration } from "@/lib/wpmCalculator";

interface QuestionTimingBreakdownProps {
  questions: StoryQuestion[];
  answers: QuestionAnswer[];
  totalTimeMs: number;
}

/**
 * "How long did the test take, and where did the time go" — per the
 * brief, timing wasn't visible anywhere before even though
 * QuestionAnswer.timeSpentMs was already being recorded for every
 * question (app/questions/page.tsx's commitAnswer). This component is
 * purely a read/display layer over that existing data — no new tracking
 * logic needed, just a place to show it.
 *
 * The bar width for each row is scaled against the slowest question in
 * *this* attempt (not a fixed max), so the relative pattern — "question 4
 * took way longer than the rest" — is visible regardless of whether the
 * reader is generally fast or slow.
 */
export function QuestionTimingBreakdown({ questions, answers, totalTimeMs }: QuestionTimingBreakdownProps) {
  const byIndex = new Map(answers.map((a) => [a.questionIndex, a]));
  const slowest = Math.max(1, ...answers.map((a) => a.timeSpentMs));

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Time per question</span>
        <span className="text-xs text-ink-muted">Total test time: {formatDuration(totalTimeMs)}</span>
      </div>
      <div className="space-y-2.5">
        {questions.map((q, i) => {
          const answer = byIndex.get(i);
          const timeMs = answer?.timeSpentMs ?? 0;
          const isSkipped = !answer || answer.selectedOption === null;
          const isCorrect = !!answer && answer.selectedOption === q.correctAnswer;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-xs text-ink-muted">{i + 1}</span>
              {isSkipped ? (
                <MinusCircle className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              ) : isCorrect ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent-medium" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-accent-extreme" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-ink-muted" title={q.question}>
                {q.question}
              </span>
              <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-overlay/10">
                <div
                  className="h-full rounded-full bg-accent-medium"
                  style={{ width: `${Math.max(4, (timeMs / slowest) * 100)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs text-ink">{formatDuration(timeMs)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
