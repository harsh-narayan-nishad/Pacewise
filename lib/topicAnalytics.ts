import { isAnswered, isCorrectAnswer } from "@/lib/grading";
import type { QuestionAnswer, StoryQuestion } from "@/types";

/**
 * Per-topic result of one test attempt. The bands and the 2-day edit window are the same numbers the backend
 * enforces (speed-reader-backend/src/modules/history/topics.ts) - the server is the one that really decides.
 */
export const STRONG_MIN = 75;
export const MEDIUM_MIN = 50;
export const EDIT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export type TopicLevel = "strong" | "medium" | "weak";
export interface TopicScore { topic: string; correct: number; total: number }

export function accuracyOf(t: TopicScore): number {
  return t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
}

export function levelOf(t: TopicScore): TopicLevel {
  const pct = t.total > 0 ? (t.correct / t.total) * 100 : 0;
  return pct >= STRONG_MIN ? "strong" : pct >= MEDIUM_MIN ? "medium" : "weak";
}

/** Questions without a topic label fall back to their chapter, then to "General". Skipped questions count as not correct. */
export function computeTopicScores(questions: StoryQuestion[], answers: QuestionAnswer[]): TopicScore[] {
  const byIndex = new Map(answers.map((a) => [a.questionIndex, a]));
  const by = new Map<string, TopicScore>();
  questions.forEach((q, i) => {
    const name = (q.topic ?? q.chapter ?? "").replace(/\s+/g, " ").trim() || "General";
    const key = name.toLowerCase();
    const cur = by.get(key) ?? { topic: name, correct: 0, total: 0 };
    cur.total += 1;
    if (isAnswered(byIndex.get(i)) && isCorrectAnswer(q, byIndex.get(i))) cur.correct += 1;
    by.set(key, cur);
  });
  return [...by.values()];
}

/** Trims names, drops empty ones and merges topics that differ only by case or spacing (first spelling wins). */
export function mergeTopics(list: TopicScore[]): TopicScore[] {
  const by = new Map<string, TopicScore>();
  for (const t of list) {
    const name = t.topic.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const cur = by.get(name.toLowerCase());
    if (cur) { cur.correct += t.correct; cur.total += t.total; }
    else by.set(name.toLowerCase(), { topic: name, correct: t.correct, total: t.total });
  }
  return [...by.values()];
}

export function groupByLevel(list: TopicScore[]): Record<TopicLevel, TopicScore[]> {
  const out: Record<TopicLevel, TopicScore[]> = { strong: [], medium: [], weak: [] };
  for (const t of list) out[levelOf(t)].push(t);
  out.strong.sort((a, b) => accuracyOf(b) - accuracyOf(a));
  out.medium.sort((a, b) => accuracyOf(b) - accuracyOf(a));
  out.weak.sort((a, b) => accuracyOf(a) - accuracyOf(b));
  return out;
}

/** Whether the topics of an attempt made at `attemptedAtIso` can still be edited, and for how much longer. */
export function editWindow(attemptedAtIso: string, now: number = Date.now()): { locked: boolean; msLeft: number } {
  const t = Date.parse(attemptedAtIso);
  const left = (Number.isNaN(t) ? 0 : t + EDIT_WINDOW_MS) - now;
  return { locked: left <= 0, msLeft: Math.max(0, left) };
}

/** "1d 4h", "5h 10m" or "12m". */
export function formatLeft(ms: number): string {
  const m = Math.max(1, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}
