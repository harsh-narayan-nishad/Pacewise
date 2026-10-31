/**
 * Plain data shapes shared by the per-user session layer. These are the
 * *serialized* forms — what actually lands in storage — kept separate from
 * the classes that behave on top of them (see DailyActivityEntry,
 * LifetimeStatsCalculator) so a stored row never carries methods.
 */

export interface SearchHistoryEntry {
  term: string;
  date: string; // ISO timestamp
}

/** One aggregated row per calendar day (local time), keyed by `toDateKey`. */
export interface DailyActivity {
  date: string; // YYYY-MM-DD
  minutes: number;
  sessions: number;
  /** Count of completed reading sessions that day. */
  storiesCompletedCount: number;
  wpmSum: number;
  wpmSamples: number;
  // Break / efficiency trend fields, kept as running sum + sample-count
  // pairs so daily averages are cheap to derive without raw arrays.
  breakMs: number;
  breakCount: number;
  effectiveWpmSum: number;
  effectiveWpmSamples: number;
  reductionPercentSum: number;
  reductionPercentSamples: number;
  /** Milliseconds spent taking tests that day (start to finish of each quiz). Optional: older rows predate it. */
  testMs?: number;
}

/** What one finished reading session contributes to a day's aggregate. */
export interface RecordSessionInput {
  minutes: number;
  wpm: number;
  completed: boolean;
  breakMs?: number;
  breakCount?: number;
  effectiveWpm?: number;
  reductionPercent?: number;
}

export interface StreakState {
  count: number;
  lastReadDate: string | null;
}

export interface QuizStats {
  attemptCount: number;
  avgAccuracy: number;
  avgTimePerQuestionMs: number;
}

export interface LifetimeStats {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  totalMinutes: number;
  totalStoriesCompleted: number;
  totalBreakMs: number;
  avgBreakMs: number;
  avgEffectiveWpm: number;
  avgReductionPercent: number;
  readingEfficiency: number;
}

/** Everything the profile's time analysis knows about one story (the serialized form). */
export interface StoryTimeData {
  storyId: string;
  title: string;
  /** Total time spent reading it, over all sessions. */
  readingMs: number;
  /** Total time spent taking its tests. */
  testMs: number;
  readingSessions: number;
  testSessions: number;
  /** ISO time of the latest reading or test. */
  lastAt: string;
  /** Milliseconds per page, summed over sessions (index 0 = page 1). Empty when no page detail exists. */
  pages: number[];
}

export interface TimeSummary {
  /** Reading + testing + documentation. */
  totalMs: number;
  readingMs: number;
  testMs: number;
  storyCount: number;
  readingSessions: number;
  testSessions: number;
  /** Time spent on documentation pages, and how many different pages. */
  docMs: number;
  docCount: number;
}

/** Time one user has spent on one documentation page (the serialized form). */
export interface DocTimeData {
  slug: string;
  title: string;
  ms: number;
  visits: number;
  lastAt: string;
}
