"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingField, SectionHeading } from "@/components/Search/StoryFormParts";
import { QuestionsInput } from "@/components/Search/QuestionsInput";
import { StoryData, StoryQuestion } from "@/types";

interface PdfQuestionsModalProps {
  /** The just-parsed media story (lib/mediaStory.ts); null keeps the modal closed. */
  story: StoryData | null;
  onClose: () => void;
  /** Called with the story carrying the title/description/questions edits; the caller persists and opens it. */
  onConfirm: (story: StoryData) => void;
}

const isComplete = (q: StoryQuestion) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2;

/**
 * Shown right after a PDF/image finishes parsing, before it opens in the reader. Same design as the
 * landing page's "Add your own story" modal, and the quiz questions can be typed one by one or
 * pasted / loaded as JSON, exactly like when adding a text story.
 */
export function PdfQuestionsModal({ story, onClose, onConfirm }: PdfQuestionsModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<StoryQuestion[]>([]);
  const [questionsValid, setQuestionsValid] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Re-seed whenever a different upload opens the modal.
  const [seededFor, setSeededFor] = useState<string | undefined>(undefined);
  if (story && story.id !== seededFor) {
    setSeededFor(story.id);
    setTitle(story.title);
    setDescription(story.description ?? "");
    setQuestions([]);
    setQuestionsValid(true);
  }

  if (!story || !mounted) return null;
  const current = story;

  function finish(withQuestions: boolean) {
    onConfirm({
      ...current,
      title: title.trim() || current.title,
      description: description.trim() || undefined,
      questions: withQuestions ? questions.filter(isComplete) : [],
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
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="panel"
          role="dialog"
          aria-label="Add quiz questions"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-4xl rounded-[32px] border border-overlay/10 bg-canvas-raised px-6 pb-10 pt-8 shadow-themed sm:px-14 sm:pb-14 sm:pt-10"
        >
          <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 rounded-full p-2 text-ink transition-colors hover:bg-overlay/10 sm:right-8 sm:top-8">
            <X className="h-6 w-6" />
          </button>

          <h2 className="mb-3 mt-6 text-center font-display text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">
            {current.media?.kind === "pdf" ? "Your PDF is ready" : "Your image is ready"}
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-center text-ink-muted sm:mb-14">
            Give it a title, then add any questions you want asked once the reader reaches the end, or skip straight to reading.
          </p>

          <div className="space-y-12">
            <FloatingField id="pdf-title" label="Title *" value={title} onChange={setTitle} />
            <FloatingField id="pdf-description" label="Short description (optional)" value={description} onChange={setDescription} multiline />

            <section>
              <SectionHeading>Quiz questions</SectionHeading>
              <QuestionsInput
                variant="form"
                value={questions}
                onChange={(qs, valid) => { setQuestions(qs); setQuestionsValid(valid); }}
              />
            </section>

            <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
              <button onClick={() => finish(false)} className="flex items-center gap-2 text-base text-ink-muted transition-colors hover:text-ink">
                <SkipForward className="h-4 w-4" /> Skip quiz, start reading
              </button>
              <Button size="lg" className="w-full sm:w-auto sm:min-w-[260px]" onClick={() => finish(true)} disabled={!title.trim() || !questionsValid}>
                Save &amp; start reading
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
