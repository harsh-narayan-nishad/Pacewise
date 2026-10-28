"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ResultCard } from "@/components/ResultCard/ResultCard";
import { ReadingEfficiencyReport } from "@/components/ResultCard/ReadingEfficiencyReport";
import { QuestionTimingBreakdown } from "@/components/ResultCard/QuestionTimingBreakdown";
import { Analytics, TrendTiles } from "@/components/Analytics/Analytics";
import { useReadingState, useReadingDispatch } from "@/contexts/ReadingContext";
import { storage } from "@/lib/storage";
import { QuizResult, ReadingHistoryEntry } from "@/types";
import { effectiveWpm as computeEffectiveWpm, storyWordCount, wpmReductionPercent } from "@/lib/wpmCalculator";
import { PageLoader } from "@/components/ui/PageLoader";
import { syncReadingSession } from "@/lib/api/sync";

export default function ResultsPage() {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);

  useEffect(() => {
    if (!state.story) router.replace("/");
  }, [state.story, router]);

  const result: QuizResult = useMemo(() => {
    const total = state.quizQuestionCount;
    let correct = 0;
    let skipped = 0;
    let answeredTime = 0;
    state.answers.forEach((a) => {
      answeredTime += a.timeSpentMs;
      if (a.selectedOption === null) skipped += 1;
      else if (state.story && state.story.questions[a.questionIndex].correctAnswer === a.selectedOption) correct += 1;
    });
    const wrong = total - correct - skipped;
    // The whole test: from "Begin quiz" to Done / Finish (falls back to the sum of per-question time).
    const totalTime = state.quizStartedAt && state.quizFinishedAt ? Math.max(0, state.quizFinishedAt - state.quizStartedAt) : answeredTime;
    return {
      total,
      correct,
      wrong: Math.max(0, wrong),
      skipped,
      accuracy: total > 0 ? (correct / total) * 100 : 0,
      avgTimePerQuestionMs: total > 0 ? totalTime / total : 0,
      totalTimeMs: totalTime,
    };
  }, [state.answers, state.quizQuestionCount, state.story, state.quizStartedAt, state.quizFinishedAt]);

  const quizQuestions = useMemo(
    () => state.story?.questions.slice(0, state.quizQuestionCount) ?? [],
    [state.story, state.quizQuestionCount]
  );

  const actualWpm = state.actualWpmSamples.length
    ? state.actualWpmSamples.reduce((a, b) => a + b, 0) / state.actualWpmSamples.length
    : state.selectedWpm;
  const readingDurationMs = state.startedAt && state.finishedAt ? state.finishedAt - state.startedAt : 0;

  const wordCount = state.story ? storyWordCount(state.story) : 0;
  const finalEffectiveWpm = computeEffectiveWpm(wordCount, readingDurationMs);
  const finalReductionPercent = wpmReductionPercent(state.selectedWpm, finalEffectiveWpm);
  const activeReadingMs = state.breakStats ? Math.max(0, readingDurationMs - state.breakStats.totalBreakMs) : readingDurationMs;

  const quizStartedIso = state.quizStartedAt ? new Date(state.quizStartedAt).toISOString() : undefined;
  const testTimeRecorded = useRef(false);
  useEffect(() => {
    // Add this test's duration to today's activity (shown when hovering a day in the consistency tracker), once.
    if (!state.story || testTimeRecorded.current || result.totalTimeMs <= 0) return;
    testTimeRecorded.current = true;
    storage.recordTestTime(result.totalTimeMs);
  }, [state.story, result.totalTimeMs]);

  const quizOnlyRecorded = useRef(false);
  useEffect(() => {
    if (!state.story) return;
    if (state.quizOnly) {
      // No reading happened: log the quiz attempt itself (speed 0 = "not a reading session"), nothing else.
      if (!quizOnlyRecorded.current) {
        quizOnlyRecorded.current = true;
        storage.addHistoryEntry({
          id: crypto.randomUUID(),
          title: state.story.title,
          date: new Date().toISOString(),
          wpm: 0,
          accuracy: result.accuracy,
          wordCount: 0,
          totalQuestions: result.total,
          correctAnswers: result.correct,
          quizTotalTimeMs: result.totalTimeMs,
          avgTimePerQuestionMs: result.avgTimePerQuestionMs,
          quizStartedAt: quizStartedIso,
        });
      }
      setHistory(storage.getHistory());
      return;
    }
    const existing = storage.getHistory();
    const latest = existing[0];
    if (latest && latest.title === state.story.title && latest.accuracy === 0) {
      storage.updateHistoryEntry(latest.id, {
        accuracy: result.accuracy,
        totalQuestions: result.total,
        correctAnswers: result.correct,
        quizTotalTimeMs: result.totalTimeMs,
        avgTimePerQuestionMs: result.avgTimePerQuestionMs,
        quizStartedAt: quizStartedIso,
      });
    }
    setHistory(storage.getHistory());

    // Mirror the complete session (reading + quiz results) to the backend,
    // if a backend account is connected — see lib/api/sync.ts. No-op when
    // the backend isn't configured/signed into, so this is purely additive.
    syncReadingSession({
      wpm: Math.round(actualWpm),
      minutes: Math.round(readingDurationMs / 60_000),
      completed: true,
      breakMs: state.breakStats?.totalBreakMs,
      breakCount: state.breakStats?.breakCount,
      effectiveWpm: finalEffectiveWpm,
      reductionPercent: finalReductionPercent,
      accuracy: result.accuracy,
      totalQuestions: result.total,
      correctAnswers: result.correct,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.story, result.accuracy]);

  if (!state.story) return <PageLoader />;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-24 pt-10 sm:px-8 sm:pt-14">
      <ResultCard
        result={result}
        selectedWpm={state.selectedWpm}
        actualWpm={actualWpm}
        readingDurationMs={readingDurationMs}
        quizOnly={state.quizOnly}
        quizStartedAt={state.quizStartedAt}
        onRestart={() => {
          dispatch({ type: "RESET_TO_DASHBOARD" });
          router.push("/");
        }}
      />

      {history.length > 0 && (
        <TrendTiles
          history={history}
          actions={[
            { label: "View analytics", href: "/analytics", primary: true },
            { label: "Past test attempts", href: "/history" },
          ]}
        />
      )}

      {quizQuestions.length > 0 && (
        <QuestionTimingBreakdown questions={quizQuestions} answers={state.answers} totalTimeMs={result.totalTimeMs} />
      )}

      {state.breakStats && (
        <ReadingEfficiencyReport
          selectedWpm={state.selectedWpm}
          effectiveWpm={finalEffectiveWpm}
          reductionPercent={finalReductionPercent}
          activeReadingMs={activeReadingMs}
          totalSessionMs={readingDurationMs}
          breakStats={state.breakStats}
        />
      )}

      <div className="pt-10">
        <h2 className="mb-4 px-1 font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">Your progress.</h2>
        <Analytics history={history} hideTrends />
      </div>
    </div>
  );
}
