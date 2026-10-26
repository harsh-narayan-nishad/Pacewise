/**
 * Reading presence — "online" status for reading, like WhatsApp's.
 *
 * A heartbeat runs every few seconds. Someone counts as *reading* only while all of these hold:
 *   1. they are on a reading surface (story article in view, reading mode, or the auto-scroll reader),
 *   2. the tab is visible, and
 *   3. they did something (scroll, key, pointer, touch) within the idle window.
 * When any of them stops holding, the status drops to "idle" on the next heartbeat and no time is added —
 * exactly how WhatsApp stops showing "online" once you go quiet. Each heartbeat that finds the user
 * reading adds the elapsed time to a per-user running total.
 *
 * No React or DOM in here: the clock is passed in, so it is unit-tested with a fake one.
 */
export type PresenceStatus = "reading" | "idle";

export interface PresenceSnapshot {
  readonly status: PresenceStatus;
  readonly totalMs: number;
}

export interface PresenceStorage {
  load(userId: string): number;
  save(userId: string, totalMs: number): void;
}

export interface PresenceOptions {
  /** How often the host calls heartbeat(); also bounds how much time one beat may add. */
  heartbeatMs?: number;
  /** No activity for this long => no longer "reading". */
  idleTimeoutMs?: number;
}

export const HEARTBEAT_MS = 5_000;
export const IDLE_TIMEOUT_MS = 60_000;

export class ReadingPresence {
  private readonly heartbeatMs: number;
  private readonly idleTimeoutMs: number;
  private userId: string | null = null;
  private totalMs = 0;
  private status: PresenceStatus = "idle";
  private lastActivity = Number.NEGATIVE_INFINITY;
  private lastBeat: number | null = null;
  private visible = true;
  private readonly surfaces = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private snapshot: PresenceSnapshot = { status: "idle", totalMs: 0 };

  constructor(private readonly store: PresenceStorage, options: PresenceOptions = {}) {
    this.heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;
    this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
  }

  // --- inputs ----------------------------------------------------------------
  /** Switch whose total is tracked (null = signed out). Saves the previous user's total first. */
  setUser(userId: string | null): void {
    if (userId === this.userId) return;
    this.flush();
    this.userId = userId;
    this.totalMs = userId ? this.store.load(userId) : 0;
    this.status = "idle";
    this.lastBeat = null;
    this.publish();
  }

  noteActivity(now: number): void {
    this.lastActivity = now;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.lastBeat = null;
  }

  /** A named place where reading can happen; several can be on at once. */
  setSurface(key: string, active: boolean): void {
    if (active) this.surfaces.add(key);
    else this.surfaces.delete(key);
  }

  // --- the heartbeat -----------------------------------------------------------
  heartbeat(now: number): void {
    const reading =
      this.userId !== null && this.visible && this.surfaces.size > 0 && now - this.lastActivity <= this.idleTimeoutMs;

    if (reading && this.lastBeat !== null) {
      // Clamp so a sleeping laptop or a throttled background timer can't add a huge gap.
      this.totalMs += Math.min(Math.max(0, now - this.lastBeat), this.heartbeatMs * 2);
    }
    this.lastBeat = reading ? now : null;

    const next: PresenceStatus = reading ? "reading" : "idle";
    const changed = next !== this.status || Math.floor(this.totalMs / 1000) !== Math.floor(this.snapshot.totalMs / 1000);
    this.status = next;
    if (changed) this.publish();
    if (reading) this.flush();
  }

  /** Persist the running total (also call on tab close). */
  flush(): void {
    if (this.userId) this.store.save(this.userId, Math.round(this.totalMs));
  }

  // --- outputs (useSyncExternalStore-compatible) ---------------------------------
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = (): PresenceSnapshot => this.snapshot;

  private publish(): void {
    this.snapshot = { status: this.status, totalMs: Math.round(this.totalMs) };
    this.listeners.forEach((l) => l());
  }
}

/** "0 min", "42 min", "1h 05m". */
export function formatReadingTotal(totalMs: number): string {
  const minutes = Math.floor(Math.max(0, totalMs) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** localStorage-backed totals, one key per user; failures (private mode, quota) are ignored. */
export class LocalPresenceStorage implements PresenceStorage {
  private key(userId: string): string {
    return `speed-reader:reading-time:${userId}`;
  }
  load(userId: string): number {
    try {
      const n = Number(window.localStorage.getItem(this.key(userId)));
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }
  save(userId: string, totalMs: number): void {
    try {
      window.localStorage.setItem(this.key(userId), String(totalMs));
    } catch {
      /* best effort */
    }
  }
}

export const readingPresence = new ReadingPresence(new LocalPresenceStorage());
