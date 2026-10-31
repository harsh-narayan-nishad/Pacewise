import { DocTimeData } from "@/lib/session/types";

const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/** VALUE OBJECT: the time one user has spent on one documentation page. Immutable, like StoryTimeRecord. */
export class DocTimeRecord {
  private constructor(private readonly data: DocTimeData) {}

  static empty(slug: string, title: string, now: Date = new Date()): DocTimeRecord {
    return new DocTimeRecord({ slug, title, ms: 0, visits: 0, lastAt: now.toISOString() });
  }

  static from(raw: unknown): DocTimeRecord | null {
    const r = raw as Partial<DocTimeData> | null;
    if (!r || typeof r.slug !== "string" || typeof r.title !== "string") return null;
    return new DocTimeRecord({
      slug: r.slug,
      title: r.title,
      ms: whole(r.ms ?? 0),
      visits: whole(r.visits ?? 0),
      lastAt: typeof r.lastAt === "string" ? r.lastAt : new Date(0).toISOString(),
    });
  }

  get slug(): string { return this.data.slug; }
  get title(): string { return this.data.title; }
  get ms(): number { return this.data.ms; }
  get visits(): number { return this.data.visits; }
  get lastAt(): string { return this.data.lastAt; }

  /** Adds time spent; `newVisit` is true for the first save of a page view, so reopening counts once. */
  withTime(ms: number, newVisit: boolean, title?: string, now: Date = new Date()): DocTimeRecord {
    return new DocTimeRecord({
      ...this.data,
      title: title ?? this.data.title,
      ms: this.data.ms + whole(ms),
      visits: this.data.visits + (newVisit ? 1 : 0),
      lastAt: now.toISOString(),
    });
  }

  toJSON(): DocTimeData {
    return { ...this.data };
  }
}
