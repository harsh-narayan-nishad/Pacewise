"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StoryQuestion } from "@/types";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: StoryQuestion;
  index: number;
  total: number;
  selected: number | null;
  flagged: boolean;
  showExplanation: boolean;
  onSelect: (option: number) => void;
  onFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export function QuestionCard({
  question,
  index,
  total,
  selected,
  flagged,
  showExplanation,
  onSelect,
  onFlag,
  onPrev,
  onNext,
  onSkip,
}: QuestionCardProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="mb-6 flex items-center justify-between text-xs text-ink-muted">
        <span>
          Question {index + 1} / {total}
        </span>
        <span>{total - index - 1} remaining</span>
      </div>
      <div className="mb-8 h-1 overflow-hidden rounded-full bg-overlay/10">
        <div className="h-full rounded-full bg-accent-medium transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl leading-snug text-ink">{question.question}</h2>
            <Button size="icon" variant={flagged ? "primary" : "ghost"} onClick={onFlag} aria-label="Flag question">
              <Flag className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {question.options.map((opt, i) => {
              const isCorrect = showExplanation && i === question.correctAnswer;
              const isWrongPick = showExplanation && selected === i && i !== question.correctAnswer;
              return (
                <button
                  key={i}
                  onClick={() => !showExplanation && onSelect(i)}
                  disabled={showExplanation}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                    selected === i && !showExplanation && "border-accent-medium bg-accent-medium/10",
                    selected !== i && !showExplanation && "border-overlay/10 hover:border-overlay/25",
                    isCorrect && "border-accent-medium bg-accent-medium/15",
                    isWrongPick && "border-accent-extreme bg-accent-extreme/15"
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {showExplanation && (
            <Card className="mt-5 text-sm text-ink-muted">
              <span className="mb-1 block font-medium text-ink">Explanation</span>
              {question.explanation}
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onPrev} disabled={index === 0}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          <SkipForward className="h-4 w-4" /> Skip
        </Button>
        <Button onClick={onNext}>
          {index === total - 1 ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
