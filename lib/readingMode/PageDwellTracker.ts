/**
 * Pure helpers for "how long did I spend on each page of this story" (no DOM, unit-tested).
 *
 * A story has no real pages, so the article is cut into *pages* of about `wordsPerPage` words (a media
 * story, i.e. an uploaded PDF or image set, keeps its own pages). `paginate` turns the article's blocks
 * into page start offsets, `pageIndexAt` finds the page under the reading line, and `PageDwellTracker`
 * adds up the milliseconds spent on each.
 */

export interface Block { top: number; words: number }

export const WORDS_PER_PAGE = 250;

/** Page start offsets (same unit as `Block.top`). A new page opens once the current one holds enough words. */
export function paginate(blocks: Block[], wordsPerPage: number = WORDS_PER_PAGE): number[] {
  const starts: number[] = [];
  let words = 0;
  for (const b of blocks) {
    if (starts.length === 0 || words >= wordsPerPage) {
      starts.push(b.top);
      words = 0;
    }
    words += Math.max(0, b.words);
  }
  return starts;
}

/** Index of the page that contains offset `y` (before the first page counts as the first). */
export function pageIndexAt(y: number, starts: number[]): number {
  if (starts.length === 0) return 0;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Accumulates reading time per page. Plain state, no timers: the caller feeds it elapsed slices. */
export class PageDwellTracker {
  private ms: number[] = [];

  /** Adds `dtMs` to page `index` (pages are created on demand). Ignores bad input. */
  tick(index: number, dtMs: number): void {
    if (!Number.isFinite(dtMs) || dtMs <= 0 || index < 0) return;
    while (this.ms.length <= index) this.ms.push(0);
    this.ms[index] += dtMs;
  }

  totalMs(): number {
    return this.ms.reduce((a, b) => a + b, 0);
  }

  /** Whole milliseconds per page, as a copy. */
  snapshot(): number[] {
    return this.ms.map((v) => Math.round(v));
  }

  reset(): void {
    this.ms = [];
  }
}
