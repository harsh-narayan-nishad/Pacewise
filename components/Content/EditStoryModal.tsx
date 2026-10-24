"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Braces, FileText, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryData, StoryQuestion } from "@/types";
import { ThumbnailPicker } from "@/components/Search/ThumbnailPicker";
import { QuestionsInput } from "@/components/Search/QuestionsInput";
import { StoryTextEditor, clearEditorDraft } from "@/components/Editor/StoryTextEditor";
import { RichDocument } from "@/lib/editor/model/RichDocument";
import { docFromStory, storyPartsFromDoc } from "@/lib/editor/storyBridge";
import { loadStory, StoryValidationError } from "@/lib/stories";
import { storage } from "@/lib/storage";

interface EditStoryModalProps {
  story: StoryData;
  onClose: () => void;
  /** Called after a save or delete actually lands in storage, so the
   *  caller (StoryCard/Dashboard) can refresh whatever list it's showing
   *  rather than this modal reaching into that state itself. */
  onSaved: (story: StoryData) => void;
  onDeleted: (id: string) => void;
}

type Mode = "form" | "json";

/**
 * Lets the owner of an uploaded/custom story (see `isCustomStory` in
 * lib/storyLibrary.ts — only a story the current browser itself added via
 * the "Add story" flow is editable/deletable at all, matching "content the
 * user uploaded") either edit it through plain fields ("Normal" tab) or
 * hand-edit its full JSON ("JSON" tab) — both write back through the same
 * `storage.saveCustomStory`, so either tab produces an identical result.
 * Deleting goes through `storage.removeCustomStory`.
 */
export function EditStoryModal({ story, onClose, onSaved, onDeleted }: EditStoryModalProps) {
  const [mode, setMode] = useState<Mode>("form");
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description ?? "");
  const [thumbnail, setThumbnail] = useState<string | undefined>(story.thumbnail);
  const [tags, setTags] = useState(story.tags?.join(", ") ?? "");
  // Rich editor replaces the paragraphs textarea; `story.story` is derived from it on save.
  const initialDoc = React.useMemo(() => (story.media ? null : docFromStory(story)), [story]);
  const [richDoc, setRichDoc] = useState<RichDocument | null>(initialDoc);
  const [questions, setQuestions] = useState<StoryQuestion[]>(() => (story.questions?.length ? story.questions : [{ question: "", options: ["", ""], correctAnswer: 0, explanation: "" }]));
  const [questionsValid, setQuestionsValid] = useState(true);
  const draftSlot = `edit-story:${story.title}`;
  const [json, setJson] = useState(() => JSON.stringify(story, null, 2));
  const [error, setError] = useState<string | string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function saveFromForm() {
    if (!title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    if (!story.media && !questionsValid) {
      setError("Fix the questions JSON first (see the errors under the question box).");
      return;
    }
    const updated: StoryData = {
      ...story,
      title: title.trim(),
      description: description.trim() || undefined,
      thumbnail,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ...(story.media || !richDoc ? {} : (({ story: st, richDocument }) => ({ story: st, richDocument }))(storyPartsFromDoc(richDoc))),
      ...(story.media ? {} : { questions: questions.filter((q) => q.question.trim() && q.options.every((o) => o.trim())) }),
    };
    if (!updated.media && updated.story.length === 0) {
      setError("At least one paragraph is required.");
      return;
    }
    clearEditorDraft(draftSlot);
    persist(updated);
  }

  function saveFromJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("That isn't valid JSON — check for a missing comma or bracket.");
      return;
    }
    try {
      const loaded = loadStory(parsed);
      persist({ ...loaded, id: story.id });
    } catch (e) {
      if (e instanceof StoryValidationError) {
        setError(e.issues);
      } else {
        setError("Could not load that story JSON.");
      }
    }
  }

  function persist(updated: StoryData) {
    setSaving(true);
    setError(null);
    window.setTimeout(() => {
      storage.saveCustomStory(updated);
      setSaving(false);
      onSaved(updated);
      onClose();
    }, 150);
  }

  function handleDelete() {
    if (!story.id) return;
    storage.removeCustomStory(story.id);
    onDeleted(story.id);
    onClose();
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgb(var(--shadow-color))]/60 p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          key="panel"
          role="dialog"
          aria-label="Edit story"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-overlay/10 bg-canvas-raised shadow-themed"
        >
          <div className="flex items-center justify-between border-b border-overlay/10 px-5 py-3.5">
            <span className="text-sm font-medium text-ink">Edit story</span>
            <button onClick={onClose} aria-label="Close" className="text-ink-faint hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-1 border-b border-overlay/10 px-5 pt-2.5">
            <button
              onClick={() => setMode("form")}
              className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm transition-colors ${
                mode === "form" ? "border-b-2 border-ink text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Normal
            </button>
            <button
              onClick={() => setMode("json")}
              className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm transition-colors ${
                mode === "json" ? "border-b-2 border-ink text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Braces className="h-3.5 w-3.5" /> JSON
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {error && (
              <div className="mb-3 rounded-lg border border-accent-extreme/30 bg-accent-extreme/5 px-3 py-2 text-xs text-accent-extreme">
                {Array.isArray(error) ? (
                  <ul className="list-disc space-y-0.5 pl-4">
                    {error.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                ) : (
                  error
                )}
              </div>
            )}

            {mode === "form" ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
                  />
                </div>
                <ThumbnailPicker value={thumbnail} onChange={setThumbnail} />
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Tags (comma-separated)</label>
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
                  />
                </div>
                {!story.media && (
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Story text</label>
                    <StoryTextEditor initial={initialDoc} draftSlot={draftSlot} onChange={setRichDoc} />
                    <div className="mt-4">
                      <div>
                                        <label className="mb-1 block text-xs text-ink-muted">Description</label>
                                        <textarea
                                          value={description}
                                          onChange={(e) => setDescription(e.target.value)}
                                          rows={2}
                                          className="w-full resize-none rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
                                        />
                                      </div>
                    </div>
                    <div className="mt-4">
                      <QuestionsInput
                        value={questions}
                        onChange={(qs, valid) => {
                          setQuestions(qs);
                          setQuestionsValid(valid);
                        }}
                      />
                    </div>
                  </div>
                )}
                {story.media && (
                  <div>
                                    <label className="mb-1 block text-xs text-ink-muted">Description</label>
                                    <textarea
                                      value={description}
                                      onChange={(e) => setDescription(e.target.value)}
                                      rows={2}
                                      className="w-full resize-none rounded-lg border border-overlay/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
                                    />
                                  </div>
                )}
                {story.media && (
                  <p className="text-xs text-ink-faint">
                    This is an uploaded PDF/image story — its pages aren't editable here, only the title, thumbnail, description
                    and tags.
                  </p>
                )}
              </div>
            ) : (
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full resize-y rounded-lg border border-overlay/15 bg-canvas px-3 py-2 font-mono text-xs text-ink outline-none focus-visible:border-accent-medium"
              />
            )}
          </div>

          <div className="flex items-center justify-between border-t border-overlay/10 px-5 py-3.5">
            {confirmingDelete ? (
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                Delete this story permanently?
                <Button size="sm" variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleDelete} className="!bg-accent-extreme !text-canvas">
                  Delete
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-accent-extreme"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete story
              </button>
            )}
            <Button size="sm" onClick={mode === "form" ? saveFromForm : saveFromJson} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
