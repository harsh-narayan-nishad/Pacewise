"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flag, SkipForward } from "lucide-react";
import { QuestionTracker, type QuestionStatus } from "@/components/Quiz/QuestionTracker";
import { Button } from "@/components/ui/button";
import { useReadingState, useReadingDispatch } from "@/contexts/ReadingContext";
import { PageLoader } from "@/components/ui/PageLoader";
import { cn } from "@/lib/utils";
import { useInertiaScroll } from "@/components/ReadingMode/useInertiaScroll";

const COUNT_PRESETS = [5, 10, 15];

/**
 * The quiz: one question at a time on the left, and on the right a live tracker of every
 * question (completed / marked for review) with a Done button. Works after reading a story or on its own.
 */
export default function QuestionsPage() {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  // Same inertial wheel/keyboard scrolling as the home page.
  useInertiaScroll(true);

  const maxAvailable = state.story?.questions.length ?? 0;
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(Math.min(5, maxAvailable));
  const [index, setIndex] = useState(0);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  /** undefined = untouched, null = skipped, number = chosen option. */
  const [picked, setPicked] = useState<Record<number, number | null>>({});
  const startedAt = useRef(Date.now());
  const times = useRef<Record<number, number>>({});

  useEffect(() => {
    if (!state.story) router.replace("/");
  }, [state.story, router]);

  const questions = useMemo(() => state.story?.questions.slice(0, count) ?? [], [state.story, count]);
  const statuses = useMemo<QuestionStatus[]>(
    () => questions.map((_, i) => (picked[i] === undefined ? "unanswered" : picked[i] === null ? "skipped" : "completed")),
    [questions, picked]
  );

  if (!state.story) return <PageLoader />;

  if (!started) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="rounded-[32px] border border-overlay/10 bg-canvas-raised p-6 sm:p-12">
          <h1 className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">Comprehension check</h1>
          <p className="mt-2 text-ink-muted">Maximum available: {maxAvailable}</p>
          <div className="mt-8 text-sm text-ink-muted">Number of questions</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {COUNT_PRESETS.filter((p) => p <= maxAvailable).map((p) => (
              <Button key={p} size="sm" variant={count === p ? "primary" : "outline"} onClick={() => setCount(p)}>
                {p}
              </Button>
            ))}
            <input
              type="number"
              value={count}
              min={1}
              max={maxAvailable}
              onChange={(e) => setCount(Math.min(maxAvailable, Math.max(1, Number(e.target.value) || 1)))}
              className="h-8 w-20 rounded-full border border-overlay/15 bg-transparent px-3 text-center text-sm text-ink"
              aria-label="Custom question count"
            />
          </div>
          <Button
            size="lg"
            className="mt-10 w-full"
            onClick={() => {
              dispatch({ type: "GO_TO_QUESTIONS", quizQuestionCount: count, quizOnly: state.quizOnly });
              startedAt.current = Date.now();
              setStarted(true);
            }}
          >
            Begin quiz
          </Button>
        </div>
      </div>
    );
  }

  const current = questions[index];
  const answered = picked[index];
  const reveal = answered !== undefined && answered !== null;

  function goTo(i: number) {
    if (i < 0 || i >= questions.length) return;
    setIndex(i);
    startedAt.current = Date.now();
  }

  function choose(option: number) {
    if (reveal) return;
    if (times.current[index] === undefined) times.current[index] = Date.now() - startedAt.current;
    setPicked((p) => ({ ...p, [index]: option }));
  }

  function skip() {
    if (picked[index] === undefined) {
      times.current[index] = Date.now() - startedAt.current;
      setPicked((p) => ({ ...p, [index]: null }));
    }
    if (index < questions.length - 1) goTo(index + 1);
  }

  function toggleMark() {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function done() {
    questions.forEach((_, i) =>
      dispatch({
        type: "ANSWER_QUESTION",
        answer: { questionIndex: i, selectedOption: picked[i] ?? null, flagged: marked.has(i), timeSpentMs: times.current[i] ?? 0 },
      })
    );
    dispatch({ type: "GO_TO_RESULTS" });
    router.push("/results");
  }

  const last = index === questions.length - 1;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
      <section aria-label="Quiz question" className="rounded-[32px] border border-overlay/10 bg-canvas-raised p-5 sm:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted sm:mb-8">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <button
            onClick={toggleMark}
            aria-pressed={marked.has(index)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
              marked.has(index) ? "border-accent-fast bg-accent-fast/10 text-ink" : "border-overlay/15 text-ink-muted hover:border-overlay/30 hover:text-ink"
            )}
          >
            <Flag className="h-4 w-4" /> {marked.has(index) ? "Marked for review" : "Mark for review"}
          </button>
        </div>

        <h1 className="font-display text-2xl leading-[1.15] tracking-[-0.03em] text-ink [overflow-wrap:anywhere] sm:text-4xl">{current.question}</h1>

        <div className="mt-8 space-y-3">
          {current.options.map((opt, i) => {
            const isCorrect = reveal && i === current.correctAnswer;
            const isWrongPick = reveal && answered === i && i !== current.correctAnswer;
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={reveal}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3.5 text-left text-base text-ink [overflow-wrap:anywhere] sm:px-5 sm:py-4 sm:text-lg transition-colors",
                  !reveal && "border-overlay/15 hover:border-overlay/35",
                  isCorrect && "border-accent-medium bg-accent-medium/15",
                  isWrongPick && "border-accent-extreme bg-accent-extreme/15",
                  reveal && !isCorrect && !isWrongPick && "border-overlay/10 text-ink-muted"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {reveal && current.explanation && (
          <div className="mt-6 rounded-2xl border border-overlay/10 p-5 text-ink-muted">
            <span className="mb-1 block font-medium text-ink">Explanation</span>
            {current.explanation}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 sm:mt-10 sm:gap-3">
          <Button variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="ghost" onClick={skip} disabled={last && picked[index] !== undefined}>
            <SkipForward className="h-4 w-4" /> Skip
          </Button>
          {last ? (
            <Button onClick={done}>Finish</Button>
          ) : (
            <Button onClick={() => goTo(index + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </section>

      <QuestionTracker questions={questions} current={index} statuses={statuses} marked={marked} onSelect={goTo} />
    </div>
  );
}
