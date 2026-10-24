"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard } from "@/components/QuestionCard/QuestionCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useReadingState, useReadingDispatch } from "@/contexts/ReadingContext";
import { QuestionAnswer } from "@/types";
import { PageLoader } from "@/components/ui/PageLoader";

const COUNT_PRESETS = [5, 10, 15];

export default function QuestionsPage() {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();

  const maxAvailable = state.story?.questions.length ?? 0;
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(Math.min(5, maxAvailable));
  const [index, setIndex] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [answersLocal, setAnswersLocal] = useState<Record<number, number | null>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());

  useEffect(() => {
    if (!state.story) router.replace("/");
  }, [state.story, router]);

  const questions = useMemo(() => state.story?.questions.slice(0, count) ?? [], [state.story, count]);

  if (!state.story) return <PageLoader />;

  if (!started) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="mb-2 font-display text-3xl text-ink">Comprehension check</h1>
        <p className="mb-6 text-sm text-ink-muted">Maximum available: {maxAvailable}</p>
        <Card className="mb-6">
          <div className="mb-3 text-sm text-ink-muted">Number of questions</div>
          <div className="flex flex-wrap gap-2">
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
        </Card>
        <Button
          size="lg"
          onClick={() => {
            setQuestionStartedAt(Date.now());
            setStarted(true);
          }}
        >
          Begin quiz
        </Button>
      </div>
    );
  }

  const current = questions[index];

  function commitAnswer(selected: number | null) {
    const answer: QuestionAnswer = {
      questionIndex: index,
      selectedOption: selected,
      flagged: flagged.has(index),
      timeSpentMs: Date.now() - questionStartedAt,
    };
    dispatch({ type: "ANSWER_QUESTION", answer });
    setAnswersLocal((prev) => ({ ...prev, [index]: selected }));
  }

  function goNext() {
    if (answersLocal[index] === undefined) commitAnswer(null);
    if (index === questions.length - 1) {
      dispatch({ type: "GO_TO_RESULTS" });
      router.push("/results");
      return;
    }
    setIndex((i) => i + 1);
    setReveal(false);
    setQuestionStartedAt(Date.now());
  }

  return (
    <QuestionCard
      question={current}
      index={index}
      total={questions.length}
      selected={answersLocal[index] ?? null}
      flagged={flagged.has(index)}
      showExplanation={reveal}
      onSelect={(option) => {
        commitAnswer(option);
        setReveal(true);
      }}
      onFlag={() =>
        setFlagged((prev) => {
          const next = new Set(prev);
          next.has(index) ? next.delete(index) : next.add(index);
          return next;
        })
      }
      onPrev={() => {
        if (index > 0) {
          setIndex((i) => i - 1);
          setReveal(answersLocal[index - 1] !== undefined);
        }
      }}
      onNext={goNext}
      onSkip={() => {
        commitAnswer(null);
        goNext();
      }}
    />
  );
}
