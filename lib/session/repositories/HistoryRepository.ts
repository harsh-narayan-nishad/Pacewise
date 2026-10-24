import { ReadingHistoryEntry } from "@/types";
import { ListRepository } from "@/lib/session/UserScopedRepository";
import { QuizStats } from "@/lib/session/types";

/**
 * One user's reading + quiz history (the "Past test attempts" page, the
 * dashboard's quiz averages). INHERITANCE: gets `getAll`/`mutate`/`clear`
 * from ListRepository and adds only history-specific rules — newest-first
 * and a 50-entry cap.
 */
export class HistoryRepository extends ListRepository<ReadingHistoryEntry> {
  static readonly MAX_ENTRIES = 50;

  protected feature(): string {
    return "history";
  }

  add(entry: ReadingHistoryEntry): void {
    this.mutate((items) => [entry, ...items].slice(0, HistoryRepository.MAX_ENTRIES));
  }

  /** Patches an entry in place by id instead of prepending a duplicate:
   *  the reading-completion placeholder (accuracy 0) and the real quiz
   *  result describe the same attempt. */
  update(id: string, patch: Partial<ReadingHistoryEntry>): ReadingHistoryEntry[] {
    return this.mutate((items) => items.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  /** Entries that actually carry quiz data, newest first. */
  quizAttempts(): ReadingHistoryEntry[] {
    return this.getAll().filter((h) => typeof h.totalQuestions === "number");
  }

  quizStats(): QuizStats {
    const attempts = this.quizAttempts();
    if (attempts.length === 0) return { attemptCount: 0, avgAccuracy: 0, avgTimePerQuestionMs: 0 };
    const avgAccuracy = attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length;
    const timed = attempts.filter((a) => typeof a.avgTimePerQuestionMs === "number");
    const avgTimePerQuestionMs = timed.length
      ? timed.reduce((sum, a) => sum + (a.avgTimePerQuestionMs ?? 0), 0) / timed.length
      : 0;
    return { attemptCount: attempts.length, avgAccuracy, avgTimePerQuestionMs };
  }
}
