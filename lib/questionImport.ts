import { StoryQuestion } from "@/types";

export const MAX_QUESTIONS = 200;
export const MAX_OPTIONS = 12;
const MAX_TEXT = 2000;

export interface ParsedQuestions {
  /** Only fully valid questions. */
  questions: StoryQuestion[];
  /** Human-readable problems, each naming the question number. Empty = all good. */
  issues: string[];
}

export const QUESTIONS_EXAMPLE = `[
  {
    "question": "What is the main idea of the passage?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 1,
    "explanation": "Why option B is right."
  }
]`;

const pick = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : typeof v === "number" ? String(v) : "");

/** Removes a BOM and a surrounding ```json fence (people paste both). */
function cleanText(text: string): string {
  let t = text.replace(/^﻿/, "").trim();
  const fence = /^```[\w-]*\s*\n([\s\S]*?)\n?```$/.exec(t);
  if (fence) t = fence[1].trim();
  return t;
}

/** Optional labels on a question: chapter, topic, year of appearance and a note shown after the test. */
function optionalMeta(o: Record<string, unknown>, problems: string[]): Pick<StoryQuestion, "chapter" | "topic" | "year" | "note"> {
  const out: Pick<StoryQuestion, "chapter" | "topic" | "year" | "note"> = {};
  const chapter = str(pick(o, ["chapter", "chapterName"]));
  const topic = str(pick(o, ["topic", "topicName"]));
  const note = str(pick(o, ["note", "notes", "afterTestNote"]));
  const rawYear = pick(o, ["year", "pyqYear", "yearOfAppearance", "appearedIn"]);
  if (chapter) out.chapter = chapter;
  if (topic) out.topic = topic;
  if (note) out.note = note;
  if (rawYear !== undefined && String(rawYear).trim() !== "") {
    const y = Number(String(rawYear).trim());
    if (Number.isInteger(y) && y >= 1900 && y <= 2100) out.year = y;
    else problems.push(`"year" (${JSON.stringify(rawYear)}) should be a 4-digit year like 2026`);
  }
  return out;
}

/** A typed number: "4.25", 4.25, "-3". */
function resolveNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(raw)) return Number(raw);
  return null;
}

/** Resolves the many ways an answer can be written to a 0-based option index. */
function resolveAnswer(raw: unknown, options: string[]): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw >= 0 && raw < options.length ? raw : null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^[A-Za-z]$/.test(t)) {
      const i = t.toUpperCase().charCodeAt(0) - 65;
      return i < options.length ? i : null;
    }
    if (/^\d+$/.test(t)) {
      const i = Number(t);
      return i < options.length ? i : null;
    }
    const byText = options.findIndex((o) => o.toLowerCase() === t.toLowerCase());
    return byText >= 0 ? byText : null;
  }
  return null;
}

/**
 * Parses pasted / uploaded quiz JSON into the app's `StoryQuestion[]`.
 *
 * Accepted shapes: `[ {…}, … ]`, `{ "questions": [ … ] }` (so a whole story
 * JSON can be pasted), and a single question object.
 * Per question: `question` (or `q`, `text`), `options` (or `choices`,
 * `answers`), the right answer as `correctAnswer` (or `answer`, `correct`,
 * `correctIndex`, `correctOption`) and `explanation` (or `explain`,
 * `rationale`). The answer may be a **0-based number**, a letter (`"B"`) or the
 * exact option text. Nothing is guessed: ambiguous or missing parts are
 * reported, not silently fixed.
 */
export function parseQuestionsInput(input: string): ParsedQuestions {
  const text = cleanText(input);
  if (!text) return { questions: [], issues: [] };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid JSON";
    return { questions: [], issues: [`That isn't valid JSON (${msg.replace(/^JSON\.parse: /, "")}).`] };
  }

  let list: unknown = data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    list = Array.isArray(o.questions) ? o.questions : pick(o, ["question", "q", "text"]) !== undefined ? [o] : undefined;
  }
  if (!Array.isArray(list)) {
    return { questions: [], issues: ["Expected an array of questions, or an object with a \"questions\" array."] };
  }
  if (list.length > MAX_QUESTIONS) {
    return { questions: [], issues: [`Too many questions (${list.length}); the limit is ${MAX_QUESTIONS}.`] };
  }

  const questions: StoryQuestion[] = [];
  const issues: string[] = [];
  list.forEach((item, i) => {
    const n = i + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) { issues.push(`Question ${n}: must be an object.`); return; }
    const o = item as Record<string, unknown>;
    const q = str(pick(o, ["question", "q", "text"]));
    const rawOpts = pick(o, ["options", "choices", "answers"]);
    const rawAns = pick(o, ["correctAnswer", "answer", "correct", "correctIndex", "correctOption", "correctAnswers"]);
    const problems: string[] = [];
    if (!q) problems.push("missing \"question\"");
    const meta = optionalMeta(o, problems);
    const noOptions = rawOpts === undefined || (Array.isArray(rawOpts) && rawOpts.length === 0);

    // Numerical-answer question: no options, the answer is a number the learner types.
    if (noOptions && rawAns !== undefined && !Array.isArray(rawAns) && resolveNumber(rawAns) !== null) {
      const explanation = str(pick(o, ["explanation", "explain", "rationale"]));
      if (!explanation) problems.push("missing \"explanation\"");
      if (problems.length) { issues.push(`Question ${n}: ${problems.join("; ")}.`); return; }
      const tol = resolveNumber(o.tolerance);
      questions.push({ question: q, options: [], correctAnswer: 0, numericAnswer: resolveNumber(rawAns) as number, ...(tol !== null ? { tolerance: tol } : {}), explanation, ...meta });
      return;
    }

    let options: string[] = [];
    if (!Array.isArray(rawOpts)) problems.push("missing \"options\" array");
    else {
      options = rawOpts.map(str);
      if (options.length < 2) problems.push("needs at least 2 options");
      else if (options.length > MAX_OPTIONS) problems.push(`has more than ${MAX_OPTIONS} options`);
      else if (options.some((x) => !x)) problems.push("has an empty option");
      else if (new Set(options.map((x) => x.toLowerCase())).size !== options.length) problems.push("has duplicate options");
    }
    let correct: number | null = null;
    let multi: number[] | null = null;
    if (rawAns === undefined) problems.push("missing \"correctAnswer\"");
    else if (options.length >= 2) {
      if (Array.isArray(rawAns)) {
        // Several right options ("select all that apply").
        const idx = rawAns.map((x) => resolveAnswer(x, options));
        if (rawAns.length === 0 || idx.some((x) => x === null)) problems.push(`"correctAnswer" (${JSON.stringify(rawAns)}) must list valid option numbers (0-based), letters or option texts`);
        else multi = Array.from(new Set(idx as number[])).sort((a, b) => a - b);
      } else {
        correct = resolveAnswer(rawAns, options);
        if (correct === null) problems.push(`"correctAnswer" (${JSON.stringify(rawAns)}) doesn't match an option — use a 0-based index, a letter, or the exact option text`);
      }
    }
    const explanation = str(pick(o, ["explanation", "explain", "rationale"]));
    if (!explanation) problems.push("missing \"explanation\"");
    if (problems.length) { issues.push(`Question ${n}: ${problems.join("; ")}.`); return; }
    if (multi) questions.push({ question: q, options, correctAnswer: multi[0], correctAnswers: multi, explanation, ...meta });
    else questions.push({ question: q, options, correctAnswer: correct as number, explanation, ...meta });
  });
  return { questions, issues };
}

/** The editor's questions as pretty JSON; blank draft rows are left out. */
export function questionsToJson(questions: readonly StoryQuestion[]): string {
  const done = questions.filter(isCompleteQuestion);
  return done.length
    ? JSON.stringify(
        done.map((q) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.numericAnswer !== undefined && q.options.length === 0 ? q.numericAnswer : q.correctAnswers?.length ? q.correctAnswers : q.correctAnswer,
          ...(q.tolerance !== undefined ? { tolerance: q.tolerance } : {}),
          explanation: q.explanation,
          ...(q.chapter ? { chapter: q.chapter } : {}),
          ...(q.topic ? { topic: q.topic } : {}),
          ...(q.year ? { year: q.year } : {}),
          ...(q.note ? { note: q.note } : {}),
        })),
        null,
        2
      )
    : "";
}

/** A question the quiz can use as-is (used to filter the one-by-one rows). */
export function isCompleteQuestion(q: StoryQuestion): boolean {
  if (q.options.length === 0 && q.numericAnswer !== undefined) return !!q.question.trim() && Number.isFinite(q.numericAnswer) && !!q.explanation.trim();
  if (q.correctAnswers?.length) return !!q.question.trim() && q.options.length >= 2 && q.options.every((o) => o.trim()) && q.correctAnswers.every((i) => i >= 0 && i < q.options.length) && !!q.explanation.trim();
  return !!q.question.trim() && q.options.length >= 2 && q.options.every((o) => o.trim()) && q.correctAnswer >= 0 && q.correctAnswer < q.options.length && !!q.explanation.trim();
}
