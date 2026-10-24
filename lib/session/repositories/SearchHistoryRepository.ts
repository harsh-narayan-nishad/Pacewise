import { ListRepository } from "@/lib/session/UserScopedRepository";
import { SearchHistoryEntry } from "@/lib/session/types";

/**
 * One user's recent searches — most recent first, case-insensitively
 * de-duplicated, capped at 30.
 *
 * POLYMORPHISM via the template-method hook: overrides `deserialize` to
 * transparently upgrade the older plain `string[]` shape (stamping
 * migrated terms with "now") while the base class's read/write flow is
 * reused untouched.
 */
export class SearchHistoryRepository extends ListRepository<SearchHistoryEntry> {
  static readonly MAX_ENTRIES = 30;

  protected feature(): string {
    return "searchHistory";
  }

  protected deserialize(raw: unknown): SearchHistoryEntry[] {
    if (!Array.isArray(raw)) return [];
    const now = new Date().toISOString();
    return raw.map((entry) => (typeof entry === "string" ? { term: entry, date: now } : (entry as SearchHistoryEntry)));
  }

  add(term: string): SearchHistoryEntry[] {
    const trimmed = term.trim();
    if (!trimmed) return this.getAll();
    return this.mutate((items) =>
      [
        { term: trimmed, date: new Date().toISOString() },
        ...items.filter((e) => e.term.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, SearchHistoryRepository.MAX_ENTRIES)
    );
  }

  /** Removes one entry (the per-item ✕), distinct from `clear()`. */
  remove(term: string): SearchHistoryEntry[] {
    return this.mutate((items) => items.filter((e) => e.term !== term));
  }
}
