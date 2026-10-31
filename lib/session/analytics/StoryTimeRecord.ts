import { StoryTimeData } from "@/lib/session/types";

const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/**
 * VALUE OBJECT: the time one user has spent on one story.
 *
 * Immutable: every `with…` method returns a new record, so a stored row never changes behind a caller's
 * back and the repository stays the only writer. Behaviour that belongs to the data (adding a reading,
 * merging page times, working out the slowest page) lives here rather than in the UI.
 */
export class StoryTimeRecord {
  private constructor(private readonly data: StoryTimeData) {}

  static empty(storyId: string, title: string, now: Date = new Date()): StoryTimeRecord {
    return new StoryTimeRecord({ storyId, title, readingMs: 0, testMs: 0, readingSessions: 0, testSessions: 0, lastAt: now.toISOString(), pages: [] });
  }

  /** Rebuilds a record from stored JSON, tolerating missing or wrong-typed fields. */
  static from(raw: unknown): StoryTimeRecord | null {
    const r = raw as Partial<StoryTimeData> | null;
    if (!r || typeof r.storyId !== "string" || typeof r.title !== "string") return null;
    return new StoryTimeRecord({
      storyId: r.storyId,
      title: r.title,
      readingMs: whole(r.readingMs ?? 0),
      testMs: whole(r.testMs ?? 0),
      readingSessions: whole(r.readingSessions ?? 0),
      testSessions: whole(r.testSessions ?? 0),
      lastAt: typeof r.lastAt === "string" ? r.lastAt : new Date(0).toISOString(),
      pages: Array.isArray(r.pages) ? r.pages.map((p) => whole(Number(p))) : [],
    });
  }

  get storyId(): string { return this.data.storyId; }
  get title(): string { return this.data.title; }
  get readingMs(): number { return this.data.readingMs; }
  get testMs(): number { return this.data.testMs; }
  get totalMs(): number { return this.data.readingMs + this.data.testMs; }
  get readingSessions(): number { return this.data.readingSessions; }
  get testSessions(): number { return this.data.testSessions; }
  get lastAt(): string { return this.data.lastAt; }
  get pages(): readonly number[] { return this.data.pages; }

  /** Adds one reading session. `pageMs` (optional) is that session's time per page. */
  withReading(ms: number, pageMs: readonly number[] = [], title?: string, now: Date = new Date()): StoryTimeRecord {
    const pages = [...this.data.pages];
    pageMs.forEach((v, i) => {
      while (pages.length <= i) pages.push(0);
      pages[i] += whole(v);
    });
    return new StoryTimeRecord({
      ...this.data,
      title: title ?? this.data.title,
      readingMs: this.data.readingMs + whole(ms),
      readingSessions: this.data.readingSessions + 1,
      lastAt: now.toISOString(),
      pages,
    });
  }

  /** Adds one finished test. */
  withTest(ms: number, title?: string, now: Date = new Date()): StoryTimeRecord {
    return new StoryTimeRecord({
      ...this.data,
      title: title ?? this.data.title,
      testMs: this.data.testMs + whole(ms),
      testSessions: this.data.testSessions + 1,
      lastAt: now.toISOString(),
    });
  }

  /** Index of the page that took longest, or -1 when there is no page detail. */
  slowestPage(): number {
    let best = -1;
    this.data.pages.forEach((v, i) => { if (v > 0 && (best < 0 || v > this.data.pages[best])) best = i; });
    return best;
  }

  toJSON(): StoryTimeData {
    return { ...this.data, pages: [...this.data.pages] };
  }
}
