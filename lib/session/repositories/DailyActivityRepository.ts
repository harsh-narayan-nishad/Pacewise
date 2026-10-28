import { UserScopedRepository } from "@/lib/session/UserScopedRepository";
import { DailyActivityEntry } from "@/lib/session/analytics/DailyActivityEntry";
import { toDateKey } from "@/lib/session/dateKey";
import { DailyActivity, RecordSessionInput } from "@/lib/session/types";

/**
 * The per-user source of truth for everything time-series: the
 * contribution calendar, the daily pace (WPM) chart, the efficiency /
 * break trends, and the lifetime streak numbers all derive from this one
 * map of `YYYY-MM-DD -> DailyActivity`. Because each user has their own
 * instance, one reader's calendar, graphs and streaks are never mixed
 * with another's.
 *
 * COMPOSITION: delegates the "how does a session fold into a day" rule to
 * DailyActivityEntry rather than re-implementing it here.
 */
export class DailyActivityRepository extends UserScopedRepository<Record<string, DailyActivity>> {
  protected feature(): string {
    return "daily";
  }

  protected emptyValue(): Record<string, DailyActivity> {
    return {};
  }

  protected deserialize(raw: unknown): Record<string, DailyActivity> {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, DailyActivity>) : {};
  }

  getAll(): Record<string, DailyActivity> {
    return this.read();
  }

  /** Break time already persisted for today (seeds the pause card's
   *  "Total Break Today"). */
  todayBreakMs(now: Date = new Date()): number {
    return this.read()[toDateKey(now)]?.breakMs ?? 0;
  }

  /** Adds one finished test's total time to today's row (creating the row if there was no reading). */
  recordTestTime(ms: number, now: Date = new Date()): DailyActivity {
    const key = toDateKey(now);
    const all = this.read();
    const existing = all[key] ? DailyActivityEntry.from(all[key]) : DailyActivityEntry.empty(key);
    const next = existing.addTestTime(ms).toJSON();
    this.write({ ...all, [key]: next });
    return next;
  }

  /** Folds one completed session into today's row and persists. */
  recordSession(input: RecordSessionInput, now: Date = new Date()): DailyActivity {
    const key = toDateKey(now);
    const all = this.read();
    const existing = all[key] ? DailyActivityEntry.from(all[key]) : DailyActivityEntry.empty(key);
    const next = existing.merge(input).toJSON();
    this.write({ ...all, [key]: next });
    return next;
  }
}
