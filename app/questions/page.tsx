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
import { CodeBlock, QuestionText } from "@/components/Quiz/QuestionText";
import { isMultilineOption } from "@/lib/questionText";
import { isCorrectAnswer, questionKind, toleranceOf } from "@/lib/grading";
import type { QuestionAnswer } from "@/types";

/** `picked` value for a multi-select / typed-number question once its answer is submitted (the answer itself is in `multi` / `typed`). */
const SUBMITTED = -1;

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
  /** Ticked options of multi-select questions, and typed text of numerical questions (drafts until submitted). */
  const [multi, setMulti] = useState<Record<number, number[]>>({});
  const [typed, setTyped] = useState<Record<number, string>>({});
  const startedAt = useRef(Date.now());
  /** Time spent looking at each question, summed over every visit (revisits count). */
  const dwell = useRef<Record<number, number>>({});

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
  const kind = questionKind(current);
  const answered = picked[index];
  const reveal = answered !== undefined && answered !== null;
  const draftOptions = multi[index] ?? [];
  const draftText = typed[index] ?? "";
  const currentAnswer = reveal ? buildAnswer(index) : undefined;
  const gotItRight = reveal && isCorrectAnswer(current, currentAnswer);

  /** Adds the time since this question was opened to its total and restarts the clock. */
  function flushDwell() {
    const now = Date.now();
    dwell.current[index] = (dwell.current[index] ?? 0) + (now - startedAt.current);
    startedAt.current = now;
  }

  /** Leaving a multi-select / numerical question with something entered submits it. */
  function lockDraft(i: number) {
    const kind = questionKind(questions[i]);
    const has = kind === "msq" ? (multi[i]?.length ?? 0) > 0 : kind === "nat" ? Number.isFinite(parseFloat((typed[i] ?? "").trim())) : false;
    if (has) setPicked((p) => (p[i] === undefined ? { ...p, [i]: SUBMITTED } : p));
  }

  function goTo(i: number) {
    if (i < 0 || i >= questions.length) return;
    flushDwell();
    lockDraft(index);
    setIndex(i);
  }

  function choose(option: number) {
    if (reveal) return;
    setPicked((p) => ({ ...p, [index]: option }));
  }

  function submitDraft() {
    lockDraft(index);
  }

  function toggleOption(option: number) {
    if (reveal) return;
    setMulti((m) => {
      const cur = m[index] ?? [];
      return { ...m, [index]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option] };
    });
  }

  function skip() {
    if (picked[index] === undefined) setPicked((p) => ({ ...p, [index]: null }));
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

  /** The stored answer for question i (a draft that was never submitted counts too). */
  function buildAnswer(i: number): QuestionAnswer {
    const q = questions[i];
    const base = { questionIndex: i, flagged: marked.has(i), timeSpentMs: dwell.current[i] ?? 0 };
    const kind = questionKind(q);
    if (picked[i] === null) return { ...base, selectedOption: null };
    if (kind === "msq") {
      const sel = [...(multi[i] ?? [])].sort((a, b) => a - b);
      return sel.length ? { ...base, selectedOption: sel[0], selectedOptions: sel } : { ...base, selectedOption: null };
    }
    if (kind === "nat") {
      const n = parseFloat((typed[i] ?? "").trim());
      return Number.isFinite(n) ? { ...base, selectedOption: null, numericValue: n } : { ...base, selectedOption: null };
    }
    return { ...base, selectedOption: picked[i] ?? null };
  }

  function done() {
    flushDwell();
    lockDraft(index);
    questions.forEach((_, i) =>
      dispatch({
        type: "ANSWER_QUESTION",
        answer: buildAnswer(i),
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

        {(current.chapter || current.topic || current.year) && (
          <div className="mb-4 flex flex-wrap gap-2 text-xs text-ink-muted sm:text-sm">
            {current.chapter && <span className="rounded-full border border-overlay/15 px-3 py-1">{current.chapter}</span>}
            {current.topic && <span className="rounded-full border border-overlay/15 px-3 py-1">{current.topic}</span>}
            {current.year && <span className="rounded-full border border-overlay/15 px-3 py-1">PYQ {current.year}</span>}
          </div>
        )}
        <QuestionText text={current.question} />

        {kind !== "mcq" && (
          <p className="mt-3 text-sm text-ink-muted">{kind === "msq" ? "Select all that apply, then check your answer." : "Type your answer as a number, then check it."}</p>
        )}

        {kind === "nat" ? (
          <div className="mt-8">
            <input
              type="text"
              inputMode="decimal"
              value={draftText}
              disabled={reveal}
              onChange={(e) => setTyped((t) => ({ ...t, [index]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submitDraft()}
              placeholder="Your answer"
              aria-label="Your numerical answer"
              className={cn(
                "w-full max-w-xs rounded-2xl border bg-transparent px-4 py-3.5 font-mono text-lg text-ink outline-none transition-colors sm:px-5 sm:py-4 sm:text-xl",
                !reveal && "border-overlay/15 focus:border-overlay/40",
                reveal && gotItRight && "border-accent-medium bg-accent-medium/15",
                reveal && !gotItRight && "border-accent-extreme bg-accent-extreme/15"
              )}
            />
            {reveal && !gotItRight && (
              <p className="mt-3 text-base text-ink-muted">
                Correct answer: <span className="font-mono text-ink">{current.numericAnswer}</span>
                {toleranceOf(current) > 0 ? ` (±${toleranceOf(current)} accepted)` : ""}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {current.options.map((opt, i) => {
              const isMulti = kind === "msq";
              const right = isMulti ? !!current.correctAnswers?.includes(i) : i === current.correctAnswer;
              const ticked = isMulti ? draftOptions.includes(i) : answered === i;
              const isCorrect = reveal && right;
              const isWrongPick = reveal && ticked && !right;
              return (
                <button
                  key={i}
                  onClick={() => (isMulti ? toggleOption(i) : choose(i))}
                  disabled={reveal}
                  role={isMulti ? "checkbox" : undefined}
                  aria-checked={isMulti ? ticked : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left text-base text-ink [overflow-wrap:anywhere] sm:px-5 sm:py-4 sm:text-lg transition-colors",
                    !reveal && !ticked && "border-overlay/15 hover:border-overlay/35",
                    !reveal && ticked && "border-overlay/50 bg-overlay/[0.06]",
                    isCorrect && "border-accent-medium bg-accent-medium/15",
                    isWrongPick && "border-accent-extreme bg-accent-extreme/15",
                    reveal && !isCorrect && !isWrongPick && "border-overlay/10 text-ink-muted"
                  )}
                >
                  {isMulti && (
                    <span aria-hidden className={cn("mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs", ticked ? "border-ink bg-ink text-canvas" : "border-overlay/30")}>
                      {ticked ? "✓" : ""}
                    </span>
                  )}
                  {isMultilineOption(opt) ? <span className="min-w-0 flex-1"><CodeBlock code={opt} lang="c" size="sm" /></span> : <span className="min-w-0">{opt}</span>}
                </button>
              );
            })}
          </div>
        )}

        {kind !== "mcq" && !reveal && (
          <Button className="mt-6" onClick={submitDraft} disabled={kind === "msq" ? draftOptions.length === 0 : !Number.isFinite(parseFloat(draftText.trim()))}>
            Check answer
          </Button>
        )}

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

      <QuestionTracker questions={questions} current={index} statuses={statuses} marked={marked} startedAt={state.quizStartedAt} onSelect={goTo} />
    </div>
  );
}
