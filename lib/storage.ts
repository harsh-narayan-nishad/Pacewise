import { ReadingHistoryEntry, StoryData } from "@/types";
import { sessionManager } from "@/lib/session/composition";
import {
  DailyActivity,
  LifetimeStats,
  QuizStats,
  RecordSessionInput,
  SearchHistoryEntry,
  StreakState,
} from "@/lib/session/types";

export type { DailyActivity, SearchHistoryEntry };
export { toDateKey } from "@/lib/session/dateKey";

/**
 * FACADE / ADAPTER over the per-user session layer (lib/session).
 *
 * Components and hooks across the app already call `storage.getHistory()`,
 * `storage.recordSession(...)`, `storage.getLifetimeStats()` and so on.
 * Rather than rewrite every call site, this object keeps that exact API
 * and forwards each call to **the active user's `UserSession`** (resolved
 * at call time via the SessionManager). The result: every existing
 * screen — history, streak calendar, pace/efficiency graphs, bookmarks,
 * uploads, search history — now reads and writes only the signed-in
 * user's own data, with no UI code changed.
 *
 * New code should prefer `useUserSession()` / `sessionManager.active()`
 * and the repository classes directly; this facade exists for continuity.
 */
const session = () => sessionManager.active();

export const storage = {
  // --- Reading + quiz history ---------------------------------------------
  getHistory(): ReadingHistoryEntry[] {
    return session().history.getAll();
  },
  addHistoryEntry(entry: ReadingHistoryEntry): void {
    session().history.add(entry);
  },
  /** Patches an entry in place by id (the reading-completion placeholder
   *  becomes the real quiz result) instead of prepending a duplicate. */
  updateHistoryEntry(id: string, patch: Partial<ReadingHistoryEntry>): ReadingHistoryEntry[] {
    return session().history.update(id, patch);
  },
  getQuizAttempts(): ReadingHistoryEntry[] {
    return session().history.quizAttempts();
  },
  getQuizStats(): QuizStats {
    return session().history.quizStats();
  },

  // --- Streak ---------------------------------------------------------------
  getStreak(): StreakState {
    return session().streak.get();
  },
  bumpStreak(): number {
    return session().streak.bump();
  },

  // --- Bookmarks ------------------------------------------------------------
  getBookmarks(): string[] {
    return session().bookmarks.getAll();
  },
  toggleBookmark(title: string): string[] {
    return session().bookmarks.toggle(title);
  },

  // --- Custom (user-uploaded) stories ----------------------------------------
  getCustomStories(): StoryData[] {
    return session().customStories.getAll();
  },
  saveCustomStory(story: StoryData): StoryData[] {
    return session().customStories.save(story);
  },
  removeCustomStory(id: string): StoryData[] {
    return session().customStories.remove(id);
  },
  /** Removes every story *this user* uploaded. Built-ins and other users'
   *  uploads are unaffected. */
  clearCustomStories(): void {
    session().customStories.clear();
  },

  // --- Search history ---------------------------------------------------------
  getSearchHistory(): SearchHistoryEntry[] {
    return session().searchHistory.getAll();
  },
  addSearchHistory(term: string): SearchHistoryEntry[] {
    return session().searchHistory.add(term);
  },
  removeSearchHistoryItem(term: string): SearchHistoryEntry[] {
    return session().searchHistory.remove(term);
  },
  clearSearchHistory(): void {
    session().searchHistory.clear();
  },

  // --- Achievements -------------------------------------------------------------
  getAchievements(): string[] {
    return session().achievements.getAll();
  },
  unlockAchievement(id: string): string[] {
    return session().achievements.unlock(id);
  },

  // --- Daily activity: calendar, pace + efficiency graphs --------------------------
  getDailyActivity(): Record<string, DailyActivity> {
    return session().daily.getAll();
  },
  /** Break time already persisted for today (seeds "Total Break Today"). */
  getTodayBreakMs(): number {
    return session().daily.todayBreakMs();
  },
  /** Merges one completed session into today's aggregate row. */
  recordTestTime(ms: number): DailyActivity {
    return session().daily.recordTestTime(ms);
  },
  recordSession(input: RecordSessionInput): DailyActivity {
    return session().daily.recordSession(input);
  },
  /** The single aggregator every "real numbers" surface reads from — see
   *  LifetimeStatsCalculator for the streak/average math. */
  getLifetimeStats(): LifetimeStats {
    return session().lifetimeStats();
  },
};
