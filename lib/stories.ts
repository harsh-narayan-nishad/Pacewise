import { StoryData, StoryQuestion } from "@/types";

/**
 * Facade over the story JSON files: every place that needs a story goes
 * through `loadStory()` / `loadStories()` instead of importing a JSON
 * file and trusting its shape. This is what lets someone add their own
 * story by dropping a new JSON file in `data/` with zero code changes —
 * the brief's target shape:
 *
 * {
 *   "id": "story-001",
 *   "title": "...",
 *   "description": "...",
 *   "difficulty": "Intermediate",
 *   "tags": ["fiction", "short"],
 *   "estimatedWPM": 200,
 *   "story": [{ "paragraph": "..." }],
 *   "questions": [{ "question": "...", "options": [...], "correctAnswer": 0, "explanation": "..." }]
 * }
 *
 * — is accepted, but so is the original shape this project shipped with
 * (`level` + `estimatedReadingTime` instead of `difficulty` +
 * `estimatedWPM`). `normalizeStory` fills in whichever pair is missing
 * from whichever pair is present, so existing data and new data both
 * resolve to the same internal `StoryData` the rest of the app already
 * uses — nothing downstream needed to change.
 */

export class StoryValidationError extends Error {
  constructor(message: string, public readonly issues: string[]) {
    super(message);
    this.name = "StoryValidationError";
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Structural validation only — this is a JSON-authored content file, not
 *  user input, so we check shape/types rather than trying to sanitize. */
export function validateStoryShape(raw: unknown): string[] {
  const issues: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return ["Story must be a JSON object"];
  }
  const r = raw as Record<string, unknown>;
  // A media (PDF/image) story — see lib/mediaStory.ts — has no paragraph
  // text at all (its pages are rendered as images), and its quiz
  // questions are optional, manually authored content (PdfQuestionsModal
  // lets the uploader skip the quiz entirely). Neither of those is a
  // defect in a media story the way an empty `story`/`questions` would be
  // in a hand-authored text one, so both checks below are skipped when
  // `media` is present instead of rejecting every PDF/image upload.
  const isMedia = typeof r.media === "object" && r.media !== null;

  if (!isNonEmptyString(r.title)) issues.push("`title` is required and must be a non-empty string");
  if (!isNonEmptyString(r.level) && !isNonEmptyString(r.difficulty)) {
    issues.push("Either `level` or `difficulty` is required");
  }
  if (typeof r.estimatedReadingTime !== "number" && typeof r.estimatedWPM !== "number") {
    issues.push("Either `estimatedReadingTime` (minutes) or `estimatedWPM` (target words-per-minute) is required");
  }
  if (!isMedia) {
    if (!Array.isArray(r.story) || r.story.length === 0) {
      issues.push("`story` must be a non-empty array of { paragraph } objects");
    } else if (r.story.some((p) => !p || typeof (p as { paragraph?: unknown }).paragraph !== "string")) {
      issues.push("Every entry in `story` needs a string `paragraph` field");
    }
  }
  if (!isMedia && (!Array.isArray(r.questions) || r.questions.length === 0)) {
    issues.push("`questions` must be a non-empty array");
  } else if (Array.isArray(r.questions)) {
    r.questions.forEach((q, i) => {
      const question = q as Partial<StoryQuestion>;
      if (!isNonEmptyString(question.question)) issues.push(`questions[${i}].question is required`);
      if (!Array.isArray(question.options) || question.options.length < 2) {
        issues.push(`questions[${i}].options needs at least 2 choices`);
      }
      if (typeof question.correctAnswer !== "number") issues.push(`questions[${i}].correctAnswer must be a number index`);
      if (!isNonEmptyString(question.explanation)) issues.push(`questions[${i}].explanation is required`);
    });
  }
  return issues;
}

/** Fills in whichever legacy/new field pair is missing, so the rest of
 *  the app can always read `level` and `estimatedReadingTime` regardless
 *  of which schema the source JSON used. */
export function normalizeStory(raw: StoryData): StoryData {
  const level = raw.level ?? raw.difficulty ?? "Intermediate";
  const estimatedReadingTime = raw.estimatedReadingTime ?? (raw.estimatedWPM ? Math.max(1, Math.round(wordsIn(raw) / raw.estimatedWPM)) : 5);
  return {
    ...raw,
    level,
    difficulty: raw.difficulty ?? level,
    estimatedReadingTime,
    estimatedWPM: raw.estimatedWPM ?? Math.round(wordsIn(raw) / Math.max(1, estimatedReadingTime)),
    tags: raw.tags ?? [],
  };
}

function wordsIn(raw: StoryData): number {
  // A media story (uploaded PDF/image — see lib/mediaStory.ts) has no
  // `story` paragraphs to count; its media object already carries its own
  // word estimate for exactly this purpose.
  if (raw.media) return raw.media.estimatedWordCount;
  return (raw.story ?? []).reduce((sum, p) => sum + (p.paragraph ?? "").trim().split(/\s+/).filter(Boolean).length, 0);
}

/** Validates then normalizes. Throws `StoryValidationError` on malformed
 *  content so a broken hand-edited JSON file fails loudly at load time
 *  instead of producing a confusing blank reading screen. */
export function loadStory(raw: unknown): StoryData {
  const issues = validateStoryShape(raw);
  if (issues.length > 0) {
    throw new StoryValidationError("Invalid story JSON", issues);
  }
  return normalizeStory(raw as StoryData);
}
