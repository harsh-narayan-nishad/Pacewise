"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { StoryData, StoryQuestion } from "@/types";
import { StoryValidationError } from "@/lib/stories";
import { addCustomStory } from "@/lib/storyLibrary";
import { Button } from "@/components/ui/button";
import { ThumbnailPicker } from "@/components/Search/ThumbnailPicker";
import { QuestionsInput } from "@/components/Search/QuestionsInput";
import { StoryTextEditor, clearEditorDraft } from "@/components/Editor/StoryTextEditor";
import { RichDocument } from "@/lib/editor/model/RichDocument";
import { storyPartsFromDoc } from "@/lib/editor/storyBridge";

const DRAFT_SLOT = "add-story";
// Level and target speed are no longer asked for; every new story gets these defaults.
const DEFAULT_LEVEL = "Intermediate";
const DEFAULT_WPM = 200;

interface AddStoryModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (story: StoryData) => void;
  /** Kept for callers that still pass it; the JSON tab no longer exists. */
  initialMode?: "form" | "json";
}

const emptyQuestion: StoryQuestion = { question: "", options: ["", ""], correctAnswer: 0, explanation: "" };

/**
 * Lets a user add their own story to the library without touching any
 * code or files — the brief's "let the user add multiple favorite/custom
 * stories" requirement. Two input modes share one validation path
 * (lib/stories.ts's loadStory): a guided form for the common case, and a
 * raw-JSON paste for anyone who already has a story in the app's native
 * schema (documented in README/the original JSON architecture spec).
 * Both end up calling the same addCustomStory(), so there is exactly one
 * place a custom story gets persisted.
 */
export function AddStoryModal({ open, onClose, onCreated }: AddStoryModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  // The story text now lives in the rich editor (lib/editor); the plain
  // paragraphs the reader needs are derived from it on submit.
  const [richDoc, setRichDoc] = useState<RichDocument | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [questionsKey, setQuestionsKey] = useState(0);
  const [questions, setQuestions] = useState<StoryQuestion[]>([{ ...emptyQuestion }]);
  const [questionsValid, setQuestionsValid] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  // Portal-rendered to document.body — see the return statement below for
  // why (the same TopNav backdrop-blur containing-block issue fixed for
  // VoiceSearchOverlay/HamburgerMenu). `mounted` guards against the
  // server/client document mismatch createPortal would otherwise hit
  // during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function reset() {
    setTitle("");
    setDescription("");
    setThumbnail(undefined);
    setRichDoc(null);
    setEditorKey((k) => k + 1);
    setQuestions([{ ...emptyQuestion }]);
    setQuestionsValid(true);
    setQuestionsKey((k) => k + 1);
    setErrors([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function submitForm() {
    const parts = richDoc ? storyPartsFromDoc(richDoc) : { story: [], richDocument: undefined, wordCount: 0 };
    const paragraphs = parts.story;

    const raw: StoryData = {
      title: title.trim(),
      description: description.trim() || undefined,
      difficulty: DEFAULT_LEVEL,
      level: DEFAULT_LEVEL,
      estimatedWPM: DEFAULT_WPM,
      estimatedReadingTime: Math.max(1, Math.round(parts.wordCount / DEFAULT_WPM)),
      thumbnail,
      tags: [],
      story: paragraphs,
      richDocument: parts.richDocument,
      questions: questions.filter((q) => q.question.trim() && q.options.every((o) => o.trim())),
    };
    create(raw);
  }

  function create(raw: unknown) {
    try {
      const story = addCustomStory(raw);
      clearEditorDraft(DRAFT_SLOT);
      reset();
      onCreated(story);
    } catch (err) {
      if (err instanceof StoryValidationError) {
        setErrors(err.issues);
      } else {
        setErrors(["Something went wrong saving that story."]);
      }
    }
  }

  // Portal-rendered straight onto document.body rather than in place: this
  // modal can now be triggered from the navbar's own compact SearchBar
  // instance (added in an earlier phase), and TopNav's `backdrop-blur` is
  // a CSS `filter`, which creates a containing block for `position: fixed`
  // descendants in modern browsers — without the portal, opening this
  // modal from the navbar would clip it to the navbar's own bounds
  // instead of covering the viewport, the same bug already fixed for
  // VoiceSearchOverlay and HamburgerMenu.
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-modal-backdrop flex items-start justify-center overflow-y-auto bg-[rgb(var(--shadow-color))]/60 px-4 py-10 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="w-full max-w-3xl rounded-2xl border border-overlay/10 bg-canvas-raised p-5 shadow-themed"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Add your own story</h2>
              <button
                onClick={handleClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errors.length > 0 && (
              <div className="mb-3 rounded-lg border border-accent-extreme/30 bg-accent-extreme/10 p-3 text-xs text-accent-extreme">
                <ul className="list-inside list-disc space-y-0.5">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Story title"
                  className="w-full rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
                />
                <ThumbnailPicker value={thumbnail} onChange={setThumbnail} />
                <StoryTextEditor
                  key={editorKey}
                  draftSlot={DRAFT_SLOT}
                  onChange={setRichDoc}
                  placeholder="Write or paste your story here. Use the ribbon for formatting, code blocks, images and tables."
                />

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description (optional) — shown on the story card"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
                />

                <QuestionsInput
                  key={questionsKey}
                  value={questions}
                  onChange={(qs, valid) => {
                    setQuestions(qs);
                    setQuestionsValid(valid);
                  }}
                />

                <Button className="w-full" onClick={submitForm} disabled={!title.trim() || !richDoc || richDoc.stats.words === 0 || !questionsValid}>
                  Add story
                </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
