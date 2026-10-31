import { StoryTimeRecord } from "@/lib/session/analytics/StoryTimeRecord";
import { DocTimeRecord } from "@/lib/session/analytics/DocTimeRecord";
import { TimeSummary } from "@/lib/session/types";

/** STRATEGY-style calculator (same role as LifetimeStatsCalculator): turns records into the totals the profile shows. */
export class TimeSummaryCalculator {
  compute(records: readonly StoryTimeRecord[], docs: readonly DocTimeRecord[] = []): TimeSummary {
    const base = records.reduce<TimeSummary>(
      (sum, r) => ({
        totalMs: sum.totalMs + r.totalMs,
        readingMs: sum.readingMs + r.readingMs,
        testMs: sum.testMs + r.testMs,
        storyCount: sum.storyCount + 1,
        readingSessions: sum.readingSessions + r.readingSessions,
        testSessions: sum.testSessions + r.testSessions,
        docMs: sum.docMs,
        docCount: sum.docCount,
      }),
      { totalMs: 0, readingMs: 0, testMs: 0, storyCount: 0, readingSessions: 0, testSessions: 0, docMs: 0, docCount: 0 }
    );
    const docMs = docs.reduce((a, d) => a + d.ms, 0);
    return { ...base, docMs, docCount: docs.length, totalMs: base.totalMs + docMs };
  }
}
