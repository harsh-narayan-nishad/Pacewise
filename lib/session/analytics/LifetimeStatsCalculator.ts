import { DailyActivity, LifetimeStats } from "@/lib/session/types";
import { toDateKey } from "@/lib/session/dateKey";

const DAY_MS = 86_400_000;

/**
 * SINGLE RESPONSIBILITY: pure computation, no storage.
 *
 * Splitting "derive the numbers" from "persist the rows" means the same
 * calculator serves every surface (dashboard stats, calendar header) and
 * is trivially testable with a hand-built map. It is stateless, so one
 * instance is safely shared by every user session.
 *
 * Streaks are computed by walking the date set day by day rather than
 * trusting a separately maintained counter, so they cannot drift from the
 * calendar they are displayed above.
 */
export class LifetimeStatsCalculator {
  compute(all: Record<string, DailyActivity>, now: Date = new Date()): LifetimeStats {
    const dateKeys = Object.keys(all).sort();
    if (dateKeys.length === 0) return this.emptyStats();

    const totalMinutes = this.sum(dateKeys, all, (d) => d.minutes);
    const totalStoriesCompleted = this.sum(dateKeys, all, (d) => d.storiesCompletedCount);
    const totalBreakMs = this.sum(dateKeys, all, (d) => d.breakMs);
    const totalBreakCount = this.sum(dateKeys, all, (d) => d.breakCount);

    const avgReductionPercent = this.averageOfDailyAverages(
      dateKeys,
      all,
      (d) => d.reductionPercentSamples,
      (d) => d.reductionPercentSum
    );

    return {
      currentStreak: this.currentStreak(new Set(dateKeys), now),
      longestStreak: this.longestStreak(dateKeys),
      totalActiveDays: dateKeys.length,
      totalMinutes,
      totalStoriesCompleted,
      totalBreakMs,
      avgBreakMs: totalBreakCount > 0 ? totalBreakMs / totalBreakCount : 0,
      avgEffectiveWpm: this.averageOfDailyAverages(
        dateKeys,
        all,
        (d) => d.effectiveWpmSamples,
        (d) => d.effectiveWpmSum
      ),
      avgReductionPercent,
      readingEfficiency: Math.max(0, Math.round(100 - avgReductionPercent)),
    };
  }

  private emptyStats(): LifetimeStats {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      totalMinutes: 0,
      totalStoriesCompleted: 0,
      totalBreakMs: 0,
      avgBreakMs: 0,
      avgEffectiveWpm: 0,
      avgReductionPercent: 0,
      readingEfficiency: 100,
    };
  }

  private sum(keys: string[], all: Record<string, DailyActivity>, pick: (d: DailyActivity) => number): number {
    return keys.reduce((total, k) => total + pick(all[k]), 0);
  }

  /** Mean over days that have samples of that day's own mean. */
  private averageOfDailyAverages(
    keys: string[],
    all: Record<string, DailyActivity>,
    samples: (d: DailyActivity) => number,
    total: (d: DailyActivity) => number
  ): number {
    const days = keys.filter((k) => samples(all[k]) > 0);
    if (days.length === 0) return 0;
    return days.reduce((s, k) => s + total(all[k]) / samples(all[k]), 0) / days.length;
  }

  private longestStreak(sortedKeys: string[]): number {
    const active = new Set(sortedKeys);
    let longest = 0;
    let running = 0;
    let cursor = new Date(sortedKeys[0]);
    const last = new Date(sortedKeys[sortedKeys.length - 1]);
    while (cursor <= last) {
      if (active.has(toDateKey(cursor))) {
        running += 1;
        longest = Math.max(longest, running);
      } else {
        running = 0;
      }
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    return longest;
  }

  /** Grace: today counts as the streak head even before today's session
   *  is logged, as long as yesterday was active — otherwise the streak
   *  would visually reset to 0 for the whole day before a user reads. */
  private currentStreak(active: Set<string>, now: Date): number {
    let probe = now;
    if (!active.has(toDateKey(probe))) probe = new Date(probe.getTime() - DAY_MS);
    let streak = 0;
    while (active.has(toDateKey(probe))) {
      streak += 1;
      probe = new Date(probe.getTime() - DAY_MS);
    }
    return streak;
  }
}
