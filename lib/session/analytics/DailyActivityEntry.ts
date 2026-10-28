import { DailyActivity, RecordSessionInput } from "@/lib/session/types";

/**
 * ENCAPSULATION of one day's aggregate. The merge rule — "a finished
 * session adds to the day's sums and sample counts" — lives on the entity
 * that owns those fields instead of being inlined in the repository.
 *
 * IMMUTABLE: `merge` returns a new entry rather than mutating, so a
 * half-applied update can never be observed or persisted.
 */
export class DailyActivityEntry {
  private constructor(private readonly data: DailyActivity) {}

  static empty(date: string): DailyActivityEntry {
    return new DailyActivityEntry({
      date,
      minutes: 0,
      sessions: 0,
      storiesCompletedCount: 0,
      wpmSum: 0,
      wpmSamples: 0,
      breakMs: 0,
      breakCount: 0,
      effectiveWpmSum: 0,
      effectiveWpmSamples: 0,
      reductionPercentSum: 0,
      reductionPercentSamples: 0,
    });
  }

  static from(data: DailyActivity): DailyActivityEntry {
    return new DailyActivityEntry({ ...data });
  }

  get date(): string {
    return this.data.date;
  }

  merge(input: RecordSessionInput): DailyActivityEntry {
    const d = this.data;
    return new DailyActivityEntry({
      ...d,
      minutes: d.minutes + Math.max(0, input.minutes),
      sessions: d.sessions + 1,
      storiesCompletedCount: d.storiesCompletedCount + (input.completed ? 1 : 0),
      wpmSum: d.wpmSum + input.wpm,
      wpmSamples: d.wpmSamples + 1,
      breakMs: d.breakMs + Math.max(0, input.breakMs ?? 0),
      breakCount: d.breakCount + Math.max(0, input.breakCount ?? 0),
      effectiveWpmSum: d.effectiveWpmSum + (input.effectiveWpm ?? 0),
      effectiveWpmSamples: d.effectiveWpmSamples + (input.effectiveWpm !== undefined ? 1 : 0),
      reductionPercentSum: d.reductionPercentSum + (input.reductionPercent ?? 0),
      reductionPercentSamples: d.reductionPercentSamples + (input.reductionPercent !== undefined ? 1 : 0),
    });
  }

  /** Adds the duration of one finished test to the day. */
  addTestTime(ms: number): DailyActivityEntry {
    return new DailyActivityEntry({ ...this.data, testMs: (this.data.testMs ?? 0) + Math.max(0, Math.round(ms)) });
  }

  toJSON(): DailyActivity {
    return { ...this.data };
  }
}
