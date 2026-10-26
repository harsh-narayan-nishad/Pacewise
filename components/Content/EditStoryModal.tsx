"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryData, StoryQuestion } from "@/types";
import { FloatingField, SectionHeading } from "@/components/Search/StoryFormParts";
import { StoryCoverPicker } from "@/components/Search/StoryCoverPicker";
import { QuestionsInput } from "@/components/Search/QuestionsInput";
import { StoryTextEditor, clearEditorDraft } from "@/components/Editor/StoryTextEditor";
import { RichDocument } from "@/lib/editor/model/RichDocument";
import { docFromStory, storyPartsFromDoc } from "@/lib/editor/storyBridge";
import { storage } from "@/lib/storage";
import { deleteThumbnailVideo } from "@/lib/thumbnailVideo";

interface EditStoryModalProps {
  story: StoryData;
  onClose: () => void;
  onSaved: (story: StoryData) => void;
  onDeleted: (id: string) => void;
}

const emptyQuestion: StoryQuestion = { question: "", options: ["", ""], correctAnswer: 0, explanation: "" };

/**
 * Edit an uploaded story. Deliberately the same design as the landing page's
 * "Add your own story" modal (shared FloatingField / SectionHeading /
 * StoryCoverPicker / QuestionsInput), pre-filled with the story's values.
 * Only the owner can reach it (callers gate on isCustomStory).
 */
export function EditStoryModal({ story, onClose, onSaved, onDeleted }: EditStoryModalProps) {
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description ?? "");
  const [thumbnail, setThumbnail] = useState<string | undefined>(story.thumbnail);
  const [thumbnailVideo, setThumbnailVideo] = useState<string | undefined>(story.thumbnailVideo);
  const [videoPoster, setVideoPoster] = useState<string | undefined>(undefined);
  const initialDoc = useMemo(() => (story.media ? null : docFromStory(story)), [story]);
  const [richDoc, setRichDoc] = useState<RichDocument | null>(initialDoc);
  const [questions, setQuestions] = useState<StoryQuestion[]>(() => (story.questions?.length ? story.questions : [{ ...emptyQuestion }]));
  const [questionsValid, setQuestionsValid] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const draftSlot = `edit-story:${story.id ?? story.title}`;

  // The video that was saved with the story must outlive Cancel; only a replaced
  // or removed one is deleted, and only once the edit is actually saved.
  const originalVideo = story.thumbnailVideo;

  function save() {
    if (!title.trim()) return setErrors(["Title can't be empty."]);
    if (!story.media && !questionsValid) return setErrors(["Fix the questions first (see the messages under the question box)."]);
    const parts = !story.media && richDoc ? storyPartsFromDoc(richDoc) : null;
    if (parts && parts.story.length === 0) return setErrors(["At least one paragraph is required."]);

    const updated: StoryData = {
      ...story,
      title: title.trim(),
      description: description.trim() || undefined,
      thumbnail: thumbnail ?? videoPoster,
      thumbnailVideo,
      ...(parts ? { story: parts.story, richDocument: parts.richDocument } : {}),
      ...(story.media ? {} : { questions: questions.filter((q) => q.question.trim() && q.options.every((o) => o.trim())) }),
    };
    setSaving(true);
    setErrors([]);
    storage.saveCustomStory(updated);
    if (originalVideo && originalVideo !== thumbnailVideo) void deleteThumbnailVideo(originalVideo);
    clearEditorDraft(draftSlot);
    setSaving(false);
    onSaved(updated);
    onClose();
  }

  function cancel() {
    // A video picked during this edit but never saved would otherwise stay in storage.
    if (thumbnailVideo && thumbnailVideo !== originalVideo) void deleteThumbnailVideo(thumbnailVideo);
    onClose();
  }

  function remove() {
    if (!story.id) return;
    storage.removeCustomStory(story.id);
    void deleteThumbnailVideo(originalVideo);
    if (thumbnailVideo && thumbnailVideo !== originalVideo) void deleteThumbnailVideo(thumbnailVideo);
    onDeleted(story.id);
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-modal-backdrop flex items-start justify-center overflow-y-auto bg-[rgb(var(--shadow-color))]/60 px-4 py-10"
        onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}
      >
        <motion.div
          key="panel"
          role="dialog"
          aria-label="Edit story"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-4xl rounded-[32px] border border-overlay/10 bg-canvas-raised px-6 pb-10 pt-8 shadow-themed sm:px-14 sm:pb-14 sm:pt-10"
        >
          <button onClick={cancel} aria-label="Close" className="absolute right-5 top-5 rounded-full p-2 text-ink transition-colors hover:bg-overlay/10 sm:right-8 sm:top-8">
            <X className="h-6 w-6" />
          </button>

          <h2 className="mb-10 mt-6 text-center font-display text-4xl leading-tight tracking-[-0.03em] text-ink sm:mb-14 sm:text-5xl">
            Edit your story
          </h2>

          {errors.length > 0 && (
            <div className="mb-6 rounded-2xl border border-accent-extreme/30 bg-accent-extreme/10 p-4 text-sm text-accent-extreme">
              <ul className="list-inside list-disc space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}

          <div className="space-y-12">
            <FloatingField id="edit-title" label="Story title *" value={title} onChange={setTitle} />

            {!story.media && (
              <section>
                <SectionHeading note="* Required">Your story</SectionHeading>
                <StoryTextEditor initial={initialDoc} draftSlot={draftSlot} onChange={setRichDoc} />
              </section>
            )}

            <section>
              <SectionHeading>Cover</SectionHeading>
              <StoryCoverPicker
                photo={thumbnail}
                onPhoto={setThumbnail}
                video={thumbnailVideo}
                videoPoster={videoPoster}
                onVideo={(v, poster) => { setThumbnailVideo(v); setVideoPoster(poster); }}
              />
            </section>

            <FloatingField id="edit-description" label="Short description (optional) — shown on the story card" value={description} onChange={setDescription} multiline />

            {!story.media ? (
              <section>
                <QuestionsInput
                  variant="form"
                  value={questions}
                  onChange={(qs, valid) => { setQuestions(qs); setQuestionsValid(valid); }}
                />
              </section>
            ) : (
              <p className="text-sm text-ink-muted">
                This is an uploaded PDF/image story — its pages can't be edited here, only the title, cover and description.
              </p>
            )}

            <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
              {confirmingDelete ? (
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  Delete this story permanently?
                  <Button size="sm" variant="outline" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
                  <Button size="sm" onClick={remove} className="!bg-accent-extreme !text-canvas">Delete</Button>
                </div>
              ) : (
                <button onClick={() => setConfirmingDelete(true)} className="flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-accent-extreme">
                  <Trash2 className="h-4 w-4" /> Delete story
                </button>
              )}
              <Button size="lg" className="w-full sm:w-auto sm:min-w-[260px]" onClick={save} disabled={saving || !title.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
