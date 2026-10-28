export interface StoryParagraph {
  paragraph: string;
}

export interface StoryQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

/** One rendered page of an uploaded PDF or image — a data URL so it needs
 *  no server/storage round-trip (see lib/mediaStory.ts, which produces
 *  these). `width`/`height` are the rendered canvas/image's own pixel
 *  dimensions, used only to give the `<img>` an intrinsic aspect ratio
 *  (see components/Reader/MediaReader.tsx) so the page doesn't jump as
 *  each image loads in. */
export interface StoryMediaPage {
  src: string;
  width: number;
  height: number;
}

/** Present on a `StoryData` built from an uploaded PDF or image (see
 *  lib/mediaStory.ts) instead of — not in addition to — real paragraph
 *  text; such a story's `story`/`questions` arrays are simply empty. */
export interface StoryMedia {
  kind: "pdf" | "image";
  pages: StoryMediaPage[];
  /** Feeds the existing WPM-based timing engine exactly like a real word
   *  count would (see lib/wpmCalculator.ts's `storyWordCount`) — either
   *  genuinely extracted text length (a PDF with a text layer) or a fixed
   *  per-page estimate (a scanned PDF or a plain image, which has no text
   *  to count). */
  estimatedWordCount: number;
}

export interface StoryData {
  /** Optional stable identifier for multi-story libraries (e.g. "story-001"). */
  id?: string;
  title: string;
  /** Optional short blurb, shown in a future library/browse view. */
  description?: string;
  /** Optional byline, shown on the landing page's story cards. Built-in
   *  stories default to "Speed Reader" in the UI when absent; a custom
   *  story can set this to the person's own name. */
  author?: string;
  level: "Beginner" | "Intermediate" | "Advanced" | string;
  /** Alias of `level` in the newer schema — see lib/stories.ts normalizeStory(). */
  difficulty?: "Beginner" | "Intermediate" | "Advanced" | string;
  estimatedReadingTime: number;
  /** Alias of `estimatedReadingTime`, expressed directly as a target WPM. */
  estimatedWPM?: number;
  tags?: string[];
  story: StoryParagraph[];
  questions: StoryQuestion[];
  /** Set instead of populating `story`/`questions` when this story is an
   *  uploaded PDF or image rather than text — see `StoryMedia` above. */
  media?: StoryMedia;
  /** Optional rich-text snapshot written by the story text editor
   *  (`lib/editor`). Treated as UNTRUSTED on load — `RichDocument.fromSnapshot`
   *  re-validates and re-sanitizes it. `story` stays the plain-paragraph
   *  projection the reading engine consumes, so nothing downstream changes. */
  richDocument?: unknown;
  /** Optional custom cover picture (downscaled JPEG data URL, see lib/thumbnail.ts). */
  thumbnail?: string;
  /** Optional hover video for the card: a reference id into IndexedDB (see lib/thumbnailVideo.ts). */
  thumbnailVideo?: string;
}

export type ReadingPhase = "dashboard" | "reading" | "completed" | "questions" | "results";

export type SpeedBand = "slow" | "medium" | "fast" | "extreme";

export interface ReadingSession {
  storyTitle: string;
  wordCount: number;
  selectedWpm: number;
  actualWpm: number;
  startedAt: number | null;
  finishedAt: number | null;
  expectedDurationMs: number;
  actualDurationMs: number;
  wasEarly: boolean;
}

export interface QuestionAnswer {
  questionIndex: number;
  selectedOption: number | null; // null = skipped
  flagged: boolean;
  timeSpentMs: number;
}

export interface QuizConfig {
  totalAvailable: number;
  selectedCount: number;
}

export interface QuizResult {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  avgTimePerQuestionMs: number;
  /** Sum of every answered/skipped question's timeSpentMs — "how long did
   *  the whole test take", distinct from the per-question average above. */
  totalTimeMs: number;
}

export interface ReadingHistoryEntry {
  id: string;
  title: string;
  date: string;
  wpm: number;
  accuracy: number;
  wordCount: number;
  /** Quiz-attempt detail, added once the quiz for this session finishes
   *  (the entry is first written with accuracy 0 right when reading
   *  completes, before the quiz has even started — see
   *  app/reader/page.tsx — then patched with these fields in
   *  app/results/page.tsx once real answers exist). Optional so older
   *  history entries written before this field existed still decode. */
  totalQuestions?: number;
  correctAnswers?: number;
  quizTotalTimeMs?: number;
  avgTimePerQuestionMs?: number;
  /** ISO time the quiz was started (set when the test begins); `date` is when it was saved. */
  quizStartedAt?: string;
}

export interface FontSettings {
  family: "serif" | "sans" | "mono";
  size: number; // px
  lineHeight: number; // unitless multiplier
  letterSpacing: number; // px
  contentWidth: number; // ch units
  brightness: "dark" | "light" | "sepia";
  focusMode: boolean;
  guideLine: boolean;
}

/** Finalized break stats for one completed reading session — computed by
 *  useBreakTracker and copied into ReadingContext when the session ends,
 *  so the Results page's efficiency report doesn't need to re-derive them. */
export interface BreakStats {
  totalBreakMs: number;
  breakCount: number;
  longestBreakMs: number;
  averageBreakMs: number;
}

/** A reader's like/dislike on a story — deliberately exclusive (setting
 *  one clears the other), matching how YouTube/most feeds treat the pair
 *  rather than letting both be active. Playlists (once also defined here)
 *  and reactions are now centralized, per-user records in
 *  `lib/devData/store.ts` rather than anonymous localStorage entries —
 *  see that file's header — so only this shared `Reaction` union (reused
 *  by `DevReaction`) still lives on the core content model. */
export type Reaction = "like" | "dislike";
