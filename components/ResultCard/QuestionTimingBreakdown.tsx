"use client";

import { isAnswered, isCorrectAnswer } from "@/lib/grading";
import React, { useState } from "react";
import { Check, X, MinusCircle } from "lucide-react";
import { QuestionAnswer, StoryQuestion } from "@/types";
import { formatDuration } from "@/lib/wpmCalculator";
import { BRAND_BLUE } from "@/lib/brand";

interface QuestionTimingBreakdownProps {
  questions: StoryQuestion[];
  answers: QuestionAnswer[];
  totalTimeMs: number;
}

const PAGE = 10;

/**
 * "How long did the test take, and where did the time go". Only 10 questions are rendered at a time;
 * "Show 10 more" loads the next page, and "Show less" collapses back, so a 100-question test stays light.
 *
 * The bar width for each row is scaled against the slowest question in *this* attempt (not a fixed
 * max), so the relative pattern is visible regardless of whether the reader is generally fast or slow.
 */
export function QuestionTimingBreakdown({ questions, answers, totalTimeMs }: QuestionTimingBreakdownProps) {
  const [shown, setShown] = useState(PAGE);
  const byIndex = new Map(answers.map((a) => [a.questionIndex, a]));
  const slowest = Math.max(1, ...answers.map((a) => a.timeSpentMs));
  const visible = questions.slice(0, shown);
  const remaining = questions.length - visible.length;

  return (
    <section className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-5 pb-8 pt-8 sm:px-10 sm:pt-12">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-4xl">Time per question.</h2>
        <span className="text-base" style={{ color: BRAND_BLUE }}>Total test time: {formatDuration(totalTimeMs)}</span>
      </div>
      <ol className="space-y-1">
        {visible.map((q, i) => {
          const answer = byIndex.get(i);
          const timeMs = answer?.timeSpentMs ?? 0;
          const isSkipped = !isAnswered(answer);
          const isCorrect = isCorrectAnswer(q, answer);
          return (
            <li key={i} className="flex flex-wrap items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-overlay/5 sm:gap-4 sm:px-3">
              <span className="w-7 shrink-0 text-sm text-ink-muted">{i + 1}</span>
              {isSkipped ? (
                <MinusCircle className="h-4 w-4 shrink-0 text-ink-faint" />
              ) : isCorrect ? (
                <Check className="h-4 w-4 shrink-0 text-accent-medium" />
              ) : (
                <X className="h-4 w-4 shrink-0 text-accent-extreme" />
              )}
              <span className="min-w-0 flex-1 truncate text-base text-ink" title={q.question}>
                {q.question}
              </span>
              <div className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-overlay/10 sm:block">
                <div className="h-full rounded-full bg-accent-medium" style={{ width: `${Math.max(4, (timeMs / slowest) * 100)}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-sm text-ink">{formatDuration(timeMs)}</span>
              {(q.chapter || q.topic || q.year || q.note) && (
                <div className="basis-full pl-10 text-sm text-ink-muted sm:pl-[3.25rem]">
                  {(q.chapter || q.topic || q.year) && (
                    <div className="text-xs">{[q.chapter, q.topic, q.year ? `PYQ ${q.year}` : ""].filter(Boolean).join(" · ")}</div>
                  )}
                  {q.note && <p className="mt-1 whitespace-pre-line">{q.note}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {questions.length > PAGE && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {remaining > 0 && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-full px-5 py-2 text-sm text-white transition-opacity hover:opacity-90" style={{ background: BRAND_BLUE }}>
              Show {Math.min(PAGE, remaining)} more
            </button>
          )}
          {shown > PAGE && (
            <button type="button" onClick={() => setShown(PAGE)} className="rounded-full border px-5 py-2 text-sm transition-colors hover:bg-overlay/5" style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}>
              Show less
            </button>
          )}
          <span className="w-full text-center text-sm text-ink-muted">Showing {visible.length} of {questions.length}</span>
        </div>
      )}
    </section>
  );
}
