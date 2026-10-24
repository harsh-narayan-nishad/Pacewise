export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * Debounced autosave: collapses a burst of edits into one write (like
 * OS write-back caching / coalescing), with `flush()` for tab-hide and
 * unmount so the last keystrokes are never lost.
 */
export class AutosaveScheduler<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: T | undefined;
  private hasPending = false;
  private status: SaveStatus = "idle";

  constructor(
    private readonly write: (value: T) => void,
    private readonly onStatus: (s: SaveStatus, error?: unknown) => void,
    private readonly delayMs = 800
  ) {}

  get current(): SaveStatus { return this.status; }
  private set(s: SaveStatus, e?: unknown) { this.status = s; this.onStatus(s, e); }

  schedule(value: T): void {
    this.pending = value;
    this.hasPending = true;
    this.set("dirty");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.hasPending) return;
    const v = this.pending as T;
    this.hasPending = false;
    this.pending = undefined;
    this.set("saving");
    try { this.write(v); this.set("saved"); } catch (e) { this.set("error", e); }
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.hasPending = false;
  }
}
