import { UserScopedRepository } from "@/lib/session/UserScopedRepository";
import { StoryTimeData } from "@/lib/session/types";
import { StoryTimeRecord } from "@/lib/session/analytics/StoryTimeRecord";

type Stored = Record<string, StoryTimeData>;

/**
 * One user's time log: how long they read and tested on each story, and page by page.
 * INHERITANCE: the base class owns key building, safe parsing and writing; this subclass only says what
 * it stores (one row per story, keyed by story id) and the intention-revealing operations on it.
 * Anything under `MIN_MS` is dropped so an accidental open does not pollute the numbers.
 */
export class TimeLogRepository extends UserScopedRepository<Stored> {
  static readonly MIN_MS = 3000;

  protected feature(): string {
    return "timelog";
  }

  protected emptyValue(): Stored {
    return {};
  }

  protected deserialize(raw: unknown): Stored {
    const out: Stored = {};
    if (raw && typeof raw === "object") {
      for (const value of Object.values(raw as Record<string, unknown>)) {
        const rec = StoryTimeRecord.from(value);
        if (rec) out[rec.storyId] = rec.toJSON();
      }
    }
    return out;
  }

  /** Every story's record, most recently active first. */
  getAll(): StoryTimeRecord[] {
    return Object.values(this.read())
      .map((d) => StoryTimeRecord.from(d))
      .filter((r): r is StoryTimeRecord => r !== null)
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }

  find(storyId: string): StoryTimeRecord | undefined {
    const raw = this.read()[storyId];
    return raw ? StoryTimeRecord.from(raw) ?? undefined : undefined;
  }

  recordReading(storyId: string, title: string, ms: number, pageMs: readonly number[] = []): void {
    if (ms < TimeLogRepository.MIN_MS) return;
    this.save((this.find(storyId) ?? StoryTimeRecord.empty(storyId, title)).withReading(ms, pageMs, title));
  }

  recordTest(storyId: string, title: string, ms: number): void {
    if (ms < 1000) return;
    this.save((this.find(storyId) ?? StoryTimeRecord.empty(storyId, title)).withTest(ms, title));
  }

  private save(record: StoryTimeRecord): void {
    this.write({ ...this.read(), [record.storyId]: record.toJSON() });
  }
}
