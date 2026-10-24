"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FileText, Plus, SkipForward, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryData, StoryQuestion } from "@/types";
import { cn } from "@/lib/utils";

interface PdfQuestionsModalProps {
  /** The just-parsed media story (see lib/mediaStory.ts) — null when the
   *  modal should be closed, same "data drives visibility" convention as
   *  the rest of this codebase's portal-rendered modals. */
  story: StoryData | null;
  onClose: () => void;
  /** Called with the story carrying whatever title/description/questions
   *  edits were made — the caller (SearchBar) is responsible for
   *  persisting it (addCustomStory) and loading it into the reader. */
  onConfirm: (story: StoryData) => void;
}

const emptyQuestion: StoryQuestion = { question: "", options: ["", ""], correctAnswer: 0, explanation: "" };

/**
 * Shown right after a PDF/image finishes parsing (lib/mediaStory.ts),
 * before it's loaded into the reader — lets the uploader fix the
 * title/description and, per the brief, author however many quiz
 * questions they want to be asked once the PDF ends. There's no way to
 * auto-extract questions from a scanned page here, so this is a manual
 * authoring UI rather than a review-and-confirm one.
 *
 * The option editor deliberately reuses QuestionCard's own visual
 * language (components/QuestionCard/QuestionCard.tsx) — the same
 * rounded-xl bordered row, the same "selected" treatment
 * (border-accent-medium bg-accent-medium/10) — so marking the correct
 * option here looks and feels like answering a question in the real
 * quiz, instead of inventing a new interaction (e.g. a plain radio input)
 * for the same concept.
 */
export function PdfQuestionsModal({ story, onClose, onConfirm }: PdfQuestionsModalProps) {
  const [title, setTitle] = useState(story?.title ?? "");
  const [description, setDescription] = useState(story?.description ?? "");
  const [questions, setQuestions] = useState<StoryQuestion[]>([]);

  // Re-seed from the new story every time a different upload opens this
  // modal — without this, a second PDF upload in the same session would
  // still show the first one's half-typed title/questions.
  const [seededFor, setSeededFor] = useState<string | undefined>(undefined);
  if (story && story.id !== seededFor) {
    setSeededFor(story.id);
    setTitle(story.title);
    setDescription(story.description ?? "");
    setQuestions([]);
  }

  if (!story) return null;

  function addQuestion() {
    setQuestions((qs) => [...qs, { ...emptyQuestion, options: ["", ""] }]);
  }

  function updateQuestion(index: number, patch: Partial<StoryQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === qIndex ? { ...q, options: q.options.map((o, oi) => (oi === oIndex ? value : o)) } : q))
    );
  }

  function removeQuestion(index: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== index));
  }

  function finish(withQuestions: boolean) {
    if (!story) return;
    const validQuestions = withQuestions
      ? questions.filter((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2)
      : [];
    onConfirm({
      ...story,
      title: title.trim() || story.title,
      description: description.trim() || undefined,
      questions: validQuestions,
    });
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-modal-backdrop flex items-start justify-center overflow-y-auto bg-[rgb(var(--shadow-color))]/60 px-4 py-10"
      >
        <motion.div
          key="panel"
          role="dialog"
          aria-label="Add quiz questions"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="w-full max-w-xl overflow-hidden rounded-2xl border border-overlay/10 bg-canvas-raised shadow-themed"
        >
          <div className="flex items-center justify-between border-b border-overlay/10 px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <FileText className="h-4 w-4 text-ink-muted" />
              {story.media?.kind === "pdf" ? "PDF uploaded" : "Image uploaded"}
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink-faint hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
            <p className="mb-4 text-xs text-ink-muted">
              Give it a title, then add any questions you want asked once the reader reaches the end — or skip
              straight to reading.
            </p>

            <div className="mb-4 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description (optional)"
                rows={2}
                className="w-full resize-none rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Quiz questions{questions.length > 0 ? ` (${questions.length})` : ""}
                </span>
              </div>

              {questions.map((q, qi) => (
                <div key={qi} className="rounded-xl border border-overlay/10 p-3.5">
                  <div className="mb-2.5 flex items-start gap-2">
                    <input
                      value={q.question}
                      onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                      placeholder={`Question ${qi + 1}`}
                      className="min-w-0 flex-1 rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
                    />
                    <button
                      onClick={() => removeQuestion(qi)}
                      aria-label="Remove question"
                      className="shrink-0 rounded-full p-1.5 text-ink-faint hover:text-accent-extreme"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Same visual language as QuestionCard's real quiz
                      options: a rounded-xl bordered row per option, with
                      the "correct answer" marked using the identical
                      selected treatment the quiz itself uses for a picked
                      answer — clicking the check circle marks it correct,
                      typing in the field edits its text. */}
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <div
                        key={oi}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
                          q.correctAnswer === oi ? "border-accent-medium bg-accent-medium/10" : "border-overlay/10"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => updateQuestion(qi, { correctAnswer: oi })}
                          aria-label={`Mark option ${oi + 1} as correct`}
                          aria-pressed={q.correctAnswer === oi}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                            q.correctAnswer === oi ? "border-accent-medium bg-accent-medium text-canvas" : "border-overlay/25 text-transparent"
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <input
                          value={opt}
                          onChange={(e) => updateOption(qi, oi, e.target.value)}
                          placeholder={`Option ${oi + 1}`}
                          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                        />
                        {q.options.length > 2 && (
                          <button
                            onClick={() =>
                              updateQuestion(qi, {
                                options: q.options.filter((_, i) => i !== oi),
                                correctAnswer: q.correctAnswer >= oi && q.correctAnswer > 0 ? q.correctAnswer - 1 : q.correctAnswer,
                              })
                            }
                            aria-label={`Remove option ${oi + 1}`}
                            className="shrink-0 text-ink-faint hover:text-accent-extreme"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => updateQuestion(qi, { options: [...q.options, ""] })}
                      className="text-xs text-ink-muted hover:text-ink"
                    >
                      + option
                    </button>
                  </div>

                  <input
                    value={q.explanation}
                    onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
                    placeholder="Explanation (shown after answering)"
                    className="mt-2.5 w-full rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-xs text-ink outline-none focus-visible:border-accent-medium"
                  />
                </div>
              ))}

              <button
                onClick={addQuestion}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-overlay/20 py-2.5 text-sm text-ink-muted transition-colors hover:border-overlay/40 hover:text-ink"
              >
                <Plus className="h-4 w-4" /> Add question
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-overlay/10 px-5 py-3.5">
            <Button variant="ghost" onClick={() => finish(false)}>
              <SkipForward className="h-3.5 w-3.5" /> Skip quiz, start reading
            </Button>
            <Button onClick={() => finish(true)}>Save & start reading</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
