"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, BookOpen, FileUp, Plus } from "lucide-react";
import { StoryData } from "@/types";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { storage, SearchHistoryEntry } from "@/lib/storage";
import { getAllStories, searchStories, addCustomStory } from "@/lib/storyLibrary";
import { setPendingFiles } from "@/lib/flipreader/handoff";
import { buildMediaStory, isMediaFile, MediaStoryError } from "@/lib/mediaStory";
import { AddStoryModal } from "@/components/Search/AddStoryModal";
import { PdfQuestionsModal } from "@/components/Search/PdfQuestionsModal";
import { VoiceSearchOverlay } from "@/components/Search/VoiceSearchOverlay";

/**
 * The uploaded AI-chat-style input (text / voice / file), kept as a
 * verbatim styled-components block — same convention as the loaders and
 * the previous pill search — so its visual design (the morphing width,
 * the upload-icon row) is untouched. Every class name and DOM sibling
 * order below matches the original, because the CSS leans on sibling
 * combinators (`.input-text:valid ~ .label-files`, `.input-voice:checked
 * ~ ...`) that only work if the markup order is preserved — the React
 * wrapper only adds `value`/`checked`/`onChange` to make these controlled
 * inputs wired to real search/voice/upload behavior instead of being
 * inert. One deliberate behavior change from the original design: the
 * mic button used to expand into an inline 300x300 panel on click; the
 * brief later asked for voice search to be its own full 100vw x 100vh
 * experience instead, so that inline-expand CSS was removed and the mic
 * button now opens VoiceSearchOverlay — see that component.
 */
const StyledSearch = styled.div`
  .container-ia-chat {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: end;
    width: 300px;
  }

  /* Wide variant (landing page): the input stretches with the container
     instead of the fixed 190/224/250px caps the compact box uses. */
  .container-ia-chat.wide .input-text {
    max-width: calc(100% - 72px);
  }
  .container-ia-chat.wide .input-text:hover,
  .container-ia-chat.wide .input-text:focus {
    width: calc(100% - 72px);
  }
  .container-ia-chat.wide .input-text:focus-within,
  .container-ia-chat.wide .input-text:valid {
    max-width: calc(100% - 42px);
  }

  .container-upload-files {
    position: absolute;
    left: 0;
    display: flex;
    color: #aaaaaa;
    transition: all 0.5s;
  }
  .container-upload-files .upload-file {
    margin: 5px;
    padding: 2px;
    cursor: pointer;
    transition: all 0.5s;
  }
  .container-upload-files .upload-file:hover {
    color: #4c4c4c;
    scale: 1.1;
  }

  .input-text {
    max-width: 190px;
    width: 100%;
    margin-left: 72px;
    padding: 0.7rem 1rem;
    padding-right: 46px;
    border-radius: 50px;
    border: none;
    outline: none;
    background-color: rgb(var(--canvas-raised));
    color: rgb(var(--ink));
    font-size: 14px;
    line-height: 18px;
    font-family: inherit;
    font-weight: 500;
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
    z-index: 999;
  }
  .input-text::placeholder {
    color: rgb(var(--ink-faint));
  }
  .input-text:hover,
  .input-text:focus {
    box-shadow: 0px 0px 1px 1px rgba(100, 100, 100, 0.1);
    outline: none;
    width: 16em;
  }
  .input-text:focus-within,
  .input-text:valid {
    max-width: 250px;
    margin-left: 42px;
  }
  .input-text:focus-within ~ .container-upload-files,
  .input-text:valid ~ .container-upload-files {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    filter: blur(5px);
  }
  .input-text:focus-within ~ .label-files,
  .input-text:valid ~ .label-files {
    transform: translateX(0) translateY(-50%) scale(1);
    opacity: 1;
    visibility: visible;
    pointer-events: all;
  }
  .input-text::selection {
    background-color: rgb(var(--ink));
    color: rgb(var(--canvas));
  }
  .input-text:valid ~ .label-text {
    transform: translateX(0) translateY(-50%) scale(1);
    opacity: 1;
    visibility: visible;
    pointer-events: all;
  }
  .input-text:valid ~ .label-voice {
    transform: translateX(0) translateY(-50%) scale(0.25);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .input-voice {
    display: none;
  }
  .input-voice:checked ~ .container-upload-files {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    filter: blur(5px);
  }
  .input-voice:checked ~ .input-text {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    filter: blur(5px);
  }

  .label-files {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateX(-20px) translateY(-50%) scale(1);
    display: flex;
    padding: 0.5rem;
    color: rgb(var(--ink-muted));
    background-color: rgb(var(--canvas-raised));
    border-radius: 50px;
    cursor: pointer;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
  }
  .label-files:hover {
    color: rgb(var(--ink));
  }

  .label-voice,
  .label-text {
    position: absolute;
    top: 50%;
    right: 0.25rem;
    transform: translateX(0) translateY(-50%) scale(1);
    width: 36px;
    height: 36px;
    display: flex;
    padding: 6px;
    border: none;
    outline: none;
    cursor: pointer;
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
    z-index: 999;
  }

  .label-voice {
    color: rgb(var(--ink-muted));
    overflow: hidden;
  }
  .label-voice:hover,
  .label-voice:focus-visible {
    color: rgb(var(--ink));
  }
  .label-voice:active svg {
    scale: 1.1;
  }
  .label-voice .icon-voice {
    position: absolute;
    transition: all 0.3s;
  }
  .label-voice .icon-voice.listening {
    color: #e05b5b;
    animation: pulse-mic 1s ease-in-out infinite;
  }

  @keyframes pulse-mic {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }

  .label-text {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-50%) scale(0.25);
    color: #e9e9e9;
    background: linear-gradient(to top right, #9147ff, #ff4141);
    box-shadow: inset 0 0 4px rgba(255, 255, 255, 0.5);
    border-radius: 50px;
  }
  .label-text:hover,
  .label-text:focus-visible {
    transform-origin: top center;
    box-shadow: inset 0 0 6px rgba(255, 255, 255, 1);
  }
  .label-text:active {
    scale: 0.9;
  }
`;

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface SearchBarProps {
  /** "default" (300px, the landing page's original/current size) or
   *  "sm" (a narrower width that actually fits a 56px navbar). The two
   *  search boxes are deliberately allowed to differ in size — this is
   *  an inline style override on the container only, so the shared CSS
   *  block above (and everything it controls) stays exactly as before. */
  size?: "default" | "sm";
}

const CONTAINER_WIDTH: Record<NonNullable<SearchBarProps["size"]>, number> = {
  default: 600,
  sm: 220,
};

export function SearchBar({ size = "default" }: SearchBarProps) {
  // The navbar renders its own SearchBar at the same time the landing
  // page renders its own (they're genuinely two separate search boxes —
  // see the brief). The markup below used hardcoded ids ("input-voice"
  // etc.) for its CSS-sibling-selector trick, which breaks the moment two
  // instances share a page: a <label htmlFor> only ever binds to the
  // *first* matching id in the document, so the second SearchBar's
  // buttons would silently drive the first one's input. useId() gives
  // each mounted instance its own id namespace while leaving every
  // className (what the CSS above actually targets) untouched.
  const uid = useId();
  const voiceId = `input-voice-${uid}`;
  const textId = `input-text-${uid}`;
  const filesId = `input-files-${uid}`;
  const router = useRouter();
  const dispatch = useReadingDispatch();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [addStoryOpen, setAddStoryOpen] = useState(false);
  const [addStoryMode, setAddStoryMode] = useState<"form" | "json">("form");
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [filesChecked, setFilesChecked] = useState(false);
  // Tracks the upload icon's PDF/image branch specifically (see
  // handleFileUpload) — the existing .json branch has no equivalent
  // async step, so it never touches this.
  const [mediaStatus, setMediaStatus] = useState<{ kind: "loading" | "error"; message?: string } | null>(null);
  // Holds a just-parsed PDF/image story between buildMediaStory() finishing
  // and the user confirming it in PdfQuestionsModal — only set while that
  // modal is open, so "modal visible" and "pending story exists" can't
  // disagree with each other.
  const [pendingMediaStory, setPendingMediaStory] = useState<StoryData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setHistory(storage.getSearchHistory());
    setVoiceSupported(!!getSpeechRecognition());
  }, []);

  const results = useMemo<StoryData[]>(() => {
    if (!query.trim()) return [];
    return searchStories(query, getAllStories()).slice(0, 8);
  }, [query]);

  // Before anyone has searched for anything (fresh install, or just a
  // fresh browser with no search history), showing nothing when the box
  // is focused would make the landing page's search a dead end — there's
  // no way to discover what's even in the library. Falls back to a plain
  // "browse all stories" list in that case, recent-searches otherwise.
  const browseStories = useMemo<StoryData[]>(() => getAllStories().slice(0, 8), []);
  const showingHistory = open && !query.trim() && history.length > 0;
  const showingBrowse = open && !query.trim() && history.length === 0 && browseStories.length > 0;
  const showingResults = open && query.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function selectStory(story: StoryData) {
    dispatch({ type: "LOAD_STORY", story });
    setHistory(storage.addSearchHistory(story.title));
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    router.push("/");
  }

  function runSearch(term: string) {
    const matches = searchStories(term, getAllStories());
    if (matches.length > 0) {
      selectStory(matches[0]);
    } else {
      setHistory(storage.addSearchHistory(term));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const list = showingResults ? results : showingHistory ? history : showingBrowse ? browseStories : [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showingResults && activeIndex >= 0 && results[activeIndex]) {
        selectStory(results[activeIndex]);
      } else if (showingHistory && activeIndex >= 0 && history[activeIndex]) {
        setQuery(history[activeIndex].term);
        runSearch(history[activeIndex].term);
      } else if (showingBrowse && activeIndex >= 0 && browseStories[activeIndex]) {
        selectStory(browseStories[activeIndex]);
      } else if (query.trim()) {
        runSearch(query);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  // --- Voice search: real browser speech recognition, not a cosmetic
  // toggle. Checking #input-voice (the mic button) starts listening and
  // opens VoiceSearchOverlay full-screen; interim transcripts stream into
  // `query` live (shown in the overlay), and a final transcript runs the
  // same search path a typed query would, then closes the overlay.
  // Unsupported browsers (no SpeechRecognition) leave the button visually
  // inert rather than throwing.
  useEffect(() => {
    if (!voiceActive) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setVoiceActive(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results as any)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setQuery(transcript);
      const last = e.results[e.results.length - 1];
      if (last?.isFinal) {
        runSearch(transcript);
        setVoiceActive(false);
      }
    };
    recognition.onerror = () => setVoiceActive(false);
    recognition.onend = () => setVoiceActive(false);
    recognitionRef.current = recognition;
    recognition.start();
    return () => recognition.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceActive]);

  // Drag & drop anywhere on the landing page behaves exactly like the upload button.
  const [dragging, setDragging] = useState(false);
  const processFileRef = useRef(processFile);
  processFileRef.current = processFile;
  useEffect(() => {
    if (size !== "default") return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    let depth = 0;
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth += 1; setDragging(true); };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragging(false); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      processFileRef.current(e.dataTransfer?.files?.[0]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [size]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    processFile(file);
  }

  // One path for both the upload button and drag & drop: story .json, PDF or image.
  function processFile(file: File | undefined) {
    if (!file) return;

    // PDF/image branch: parsed entirely client-side (see
    // lib/mediaStory.ts) into a story whose pages auto-scroll in the
    // reader exactly like text does, with every existing control (speed,
    // play/pause, the Speedometer, etc.) already applying to it — see
    // that module's header comment for why this skips the JSON
    // validation/persistence path below rather than reusing it.
    // A PDF opens straight in the flip book reader.
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      setPendingFiles([file]);
      router.push("/flipbook");
      return;
    }

    if (isMediaFile(file)) {
      setMediaStatus({ kind: "loading" });
      buildMediaStory(file)
        .then((story) => {
          setMediaStatus(null);
          // Hand off to PdfQuestionsModal instead of loading straight into
          // the reader — lets the uploader fix the title and author quiz
          // questions for it before it's persisted/opened (see that
          // component's header comment).
          setPendingMediaStory(story);
        })
        .catch((err) => {
          setMediaStatus({
            kind: "error",
            message: err instanceof MediaStoryError ? err.message : "Couldn't read that file.",
          });
        });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const story = addCustomStory(parsed);
        selectStory(story);
      } catch {
        setAddStoryMode("json");
        setAddStoryOpen(true);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div ref={containerRef} className="relative">
      <StyledSearch>
        <div
          className={`container-ia-chat${size === "default" ? " wide" : ""}`}
          style={{ width: CONTAINER_WIDTH[size], maxWidth: "calc(100vw - 48px)" }}
        >
          <input
            type="checkbox"
            name="input-voice"
            id={voiceId}
            className="input-voice"
            style={{ display: "none" }}
            checked={voiceActive}
            onChange={(e) => setVoiceActive(e.target.checked)}
          />
          <input
            ref={inputRef}
            type="text"
            name="input-text"
            id={textId}
            placeholder="Ask Anything..."
            className="input-text"
            required
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            aria-label="Search stories"
            aria-haspopup="listbox"
            aria-expanded={open}
          />
          <input
            type="checkbox"
            name="input-files"
            id={filesId}
            className="input-files"
            style={{ display: "none" }}
            checked={filesChecked}
            onChange={(e) => setFilesChecked(e.target.checked)}
          />
          <div className="container-upload-files">
            {/* File icon: opens the laptop's own file picker to upload a
                story .json, a PDF, or an image straight off disk — not a
                camera/photo icon, since that's not what this button does.
                A PDF/image is read and auto-scrolled page-by-page in the
                reader the same way a text story scrolls paragraph-by-
                paragraph (see lib/mediaStory.ts); a .json file still goes
                through the existing story-library validation path. */}
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Upload a story .json, a PDF, or an image from your computer"
            >
              <FileUp className="upload-file" size={22} strokeWidth={2} />
            </div>
            {/* Plus icon: opens the "add a new story" guided form — a
                distinct action from uploading an existing file. */}
            <div
              onClick={() => {
                setAddStoryMode("form");
                setAddStoryOpen(true);
              }}
              title="Add a new story"
            >
              <Plus className="upload-file" size={22} strokeWidth={2} />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,application/pdf,image/*,.json,.pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          <label
            htmlFor={filesId}
            className="label-files"
            onClick={(e) => {
              e.preventDefault();
              setAddStoryMode("form");
              setAddStoryOpen(true);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14" />
            </svg>
          </label>
          {/* Checking this no longer grows an inline panel — it opens
              VoiceSearchOverlay instead, a true 100vw x 100vh experience
              rendered through a portal (see that component for why). */}
          <label htmlFor={voiceId} className="label-voice" title={voiceSupported ? "Search by voice" : "Voice search isn't supported in this browser"}>
            <svg className={`icon-voice ${voiceActive ? "listening" : ""}`} xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} d="M12 4v16m4-13v10M8 7v10m12-6v2M4 11v2" />
            </svg>
          </label>
          <label
            htmlFor={textId}
            className="label-text"
            onClick={(e) => {
              if (query.trim()) {
                e.preventDefault();
                runSearch(query);
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12l7-7l7 7m-7 7V5" />
            </svg>
          </label>
        </div>
      </StyledSearch>

      <AnimatePresence>
        {(showingResults || showingHistory || showingBrowse) && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute inset-x-0 top-full z-30 mt-2 min-w-[260px] overflow-hidden rounded-xl border border-overlay/10 bg-canvas-raised/95 py-1.5 shadow-themed backdrop-blur-xl"
          >
            {showingResults &&
              (results.length > 0 ? (
                results.map((story, i) => (
                  <button
                    key={story.id ?? story.title}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => selectStory(story)}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-2 text-left transition-colors ${
                      i === activeIndex ? "bg-overlay/5" : ""
                    }`}
                  >
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{story.title}</span>
                      {story.description && (
                        <span className="block truncate text-xs text-ink-muted">{story.description}</span>
                      )}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3.5 py-2.5 text-sm text-ink-muted">No stories match &ldquo;{query}&rdquo;.</div>
              ))}

            {showingHistory &&
              history.map((entry, i) => (
                <button
                  key={entry.term}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => {
                    setQuery(entry.term);
                    runSearch(entry.term);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-ink transition-colors ${
                    i === activeIndex ? "bg-overlay/5" : ""
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0 text-ink-muted" />
                  <span className="truncate">{entry.term}</span>
                </button>
              ))}

            {showingBrowse && (
              <>
                <div className="px-3.5 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Browse stories
                </div>
                {browseStories.map((story, i) => (
                  <button
                    key={story.id ?? story.title}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => selectStory(story)}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-2 text-left transition-colors ${
                      i === activeIndex ? "bg-overlay/5" : ""
                    }`}
                  >
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{story.title}</span>
                      {story.description && (
                        <span className="block truncate text-xs text-ink-muted">{story.description}</span>
                      )}
                    </span>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status for the PDF/image upload branch specifically (see
          handleFileUpload) — rendering a PDF's pages to canvas takes a
          moment on a long document, and a corrupt/unreadable file needs
          somewhere to report that isn't a silent no-op. */}
      <AnimatePresence>
        {mediaStatus && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`absolute inset-x-0 top-full z-30 mt-2 rounded-lg border px-3.5 py-2 text-xs ${
              mediaStatus.kind === "error"
                ? "border-accent-extreme/30 bg-accent-extreme/10 text-accent-extreme"
                : "border-overlay/10 bg-canvas-raised/95 text-ink-muted"
            }`}
          >
            {mediaStatus.kind === "loading" ? (
              "Reading your file…"
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span>{mediaStatus.message}</span>
                <button onClick={() => setMediaStatus(null)} className="shrink-0 font-medium text-ink hover:underline">
                  Dismiss
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {dragging && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[150] flex items-center justify-center bg-canvas/60 backdrop-blur-md">
          <div className="rounded-[32px] border-2 border-dashed border-ink/40 px-12 py-10 text-center">
            <div className="font-display text-3xl tracking-[-0.03em] text-ink">Drop to upload</div>
            <div className="mt-1 text-sm text-ink-muted">A story .json, a PDF or an image</div>
          </div>
        </div>
      )}

      <AddStoryModal
        open={addStoryOpen}
        initialMode={addStoryMode}
        onClose={() => setAddStoryOpen(false)}
        onCreated={(story) => {
          setAddStoryOpen(false);
          selectStory(story);
        }}
      />

      <PdfQuestionsModal
        story={pendingMediaStory}
        onClose={() => setPendingMediaStory(null)}
        onConfirm={(story) => {
          setPendingMediaStory(null);
          // Persisted as a custom story (same path as AddStoryModal/JSON
          // upload) rather than loaded transiently — this is what makes an
          // uploaded PDF show up in "your uploads," and editable/deletable
          // later via EditStoryModal (see isCustomStory in storyLibrary.ts).
          const saved = addCustomStory(story);
          selectStory(saved);
        }}
      />

      <VoiceSearchOverlay
        open={voiceActive}
        query={query}
        supported={voiceSupported}
        onClose={() => setVoiceActive(false)}
      />
    </div>
  );
}
