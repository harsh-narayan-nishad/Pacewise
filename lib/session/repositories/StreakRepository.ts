import { UserScopedRepository } from "@/lib/session/UserScopedRepository";
import { StreakState } from "@/lib/session/types";

/**
 * One user's "consecutive days read" counter. Extends the base directly
 * (its value is an object, not a list). Stores count + last-read day as a
 * single record so the two can never be written out of step.
 */
export class StreakRepository extends UserScopedRepository<StreakState> {
  protected feature(): string {
    return "streak";
  }

  protected emptyValue(): StreakState {
    return { count: 0, lastReadDate: null };
  }

  protected deserialize(raw: unknown): StreakState {
    const r = raw as Partial<StreakState> | null;
    return {
      count: typeof r?.count === "number" ? r.count : 0,
      lastReadDate: typeof r?.lastReadDate === "string" ? r.lastReadDate : null,
    };
  }

  get(): StreakState {
    return this.read();
  }

  /** Reading twice on the same day doesn't double count; reading the day
   *  after extends the streak; any gap restarts it at 1. */
  bump(now: Date = new Date()): number {
    const today = now.toDateString();
    const { count, lastReadDate } = this.read();
    if (lastReadDate === today) return count;
    const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
    const next = lastReadDate === yesterday ? count + 1 : 1;
    this.write({ count: next, lastReadDate: today });
    return next;
  }
}
