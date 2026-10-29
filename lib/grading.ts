import type { QuestionAnswer, StoryQuestion } from "@/types";

export type QuestionKind = "mcq" | "msq" | "nat";

/** single choice, "select all that apply", or a typed number (no options). */
export function questionKind(q: Pick<StoryQuestion, "options" | "correctAnswers" | "numericAnswer">): QuestionKind {
  if (q.options.length === 0 && q.numericAnswer !== undefined) return "nat";
  if (q.correctAnswers && q.correctAnswers.length > 0) return "msq";
  return "mcq";
}

/** Numbers like 4.25 are accepted ±0.01 unless the question says otherwise; whole numbers must match exactly. */
export function toleranceOf(q: Pick<StoryQuestion, "numericAnswer" | "tolerance">): number {
  if (q.tolerance !== undefined) return Math.abs(q.tolerance);
  return q.numericAnswer !== undefined && !Number.isInteger(q.numericAnswer) ? 0.01 : 0;
}

/** Did the learner give any answer at all (as opposed to skipping)? */
export function isAnswered(a: QuestionAnswer | undefined): boolean {
  if (!a) return false;
  return a.selectedOption !== null || (a.selectedOptions?.length ?? 0) > 0 || a.numericValue !== undefined;
}

export function isCorrectAnswer(q: StoryQuestion, a: QuestionAnswer | undefined): boolean {
  if (!a || !isAnswered(a)) return false;
  switch (questionKind(q)) {
    case "nat":
      return a.numericValue !== undefined && q.numericAnswer !== undefined && Math.abs(a.numericValue - q.numericAnswer) <= toleranceOf(q) + 1e-9;
    case "msq": {
      const want = new Set(q.correctAnswers);
      const got = new Set(a.selectedOptions ?? []);
      return want.size === got.size && Array.from(want).every((i) => got.has(i));
    }
    default:
      return a.selectedOption === q.correctAnswer;
  }
}

/** The right answer as text, for showing under a wrong answer. */
export function describeCorrect(q: StoryQuestion): string {
  switch (questionKind(q)) {
    case "nat":
      return String(q.numericAnswer);
    case "msq":
      return (q.correctAnswers ?? []).map((i) => String.fromCharCode(65 + i)).join(", ");
    default:
      return String.fromCharCode(65 + q.correctAnswer);
  }
}
