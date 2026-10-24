import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";

/**
 * Cross-tab mutual exclusion for editing one document, so two tabs cannot
 * silently overwrite each other (classic lost-update problem).
 * Uses a lease: the holder renews a timestamp; a crashed holder's lease
 * expires, so the lock can never deadlock (OS: lock with timeout).
 */
export class EditLock {
  private readonly owner = `t${Math.random().toString(36).slice(2, 10)}`;
  private beat: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly kv: KeyValueStore, private readonly key: string, private readonly leaseMs = 6000, private readonly now: () => number = Date.now) {}

  private read(): { owner: string; until: number } | null {
    try { const r = this.kv.getItem(this.key); return r ? JSON.parse(r) : null; } catch { return null; }
  }

  /** True if this tab now holds (or already held) the lock. */
  acquire(): boolean {
    const cur = this.read();
    if (cur && cur.owner !== this.owner && cur.until > this.now()) return false;
    this.write();
    // Re-read: if another tab wrote between our check and write, the last writer wins.
    if (this.read()?.owner !== this.owner) return false;
    if (!this.beat && typeof setInterval !== "undefined") this.beat = setInterval(() => this.write(), this.leaseMs / 3);
    return true;
  }

  private write(): void {
    try { this.kv.setItem(this.key, JSON.stringify({ owner: this.owner, until: this.now() + this.leaseMs })); } catch { /* ignore */ }
  }

  release(): void {
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
    if (this.read()?.owner === this.owner) this.kv.removeItem(this.key);
  }
}
