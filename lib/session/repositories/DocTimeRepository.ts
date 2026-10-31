import { UserScopedRepository } from "@/lib/session/UserScopedRepository";
import { DocTimeData } from "@/lib/session/types";
import { DocTimeRecord } from "@/lib/session/analytics/DocTimeRecord";

type Stored = Record<string, DocTimeData>;

/** One user's time on documentation pages, one row per page (keyed by its slug). Same shape as TimeLogRepository. */
export class DocTimeRepository extends UserScopedRepository<Stored> {
  protected feature(): string {
    return "doctime";
  }

  protected emptyValue(): Stored {
    return {};
  }

  protected deserialize(raw: unknown): Stored {
    const out: Stored = {};
    if (raw && typeof raw === "object") {
      for (const value of Object.values(raw as Record<string, unknown>)) {
        const rec = DocTimeRecord.from(value);
        if (rec) out[rec.slug] = rec.toJSON();
      }
    }
    return out;
  }

  /** Every page's record, most recently read first. */
  getAll(): DocTimeRecord[] {
    return Object.values(this.read())
      .map((d) => DocTimeRecord.from(d))
      .filter((r): r is DocTimeRecord => r !== null)
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }

  record(slug: string, title: string, ms: number, newVisit: boolean): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const current = DocTimeRecord.from(this.read()[slug]) ?? DocTimeRecord.empty(slug, title);
    const next = current.withTime(ms, newVisit, title);
    this.write({ ...this.read(), [slug]: next.toJSON() });
  }
}
