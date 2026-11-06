import { isApiEnabled } from "@/lib/api/config";
import { toDateKey } from "@/lib/session/dateKey";

// The HTTP client is loaded on first use: it depends (through the token store) on the session layer,
// which in turn wraps its storage with SyncingKeyValueStore -> this file. A static import would be a cycle.
const api = async () => (await import("@/lib/api/client")).apiFetch;

/**
 * Sends reading-time events and per-user data blobs (history, streak, daily activity, bookmarks,
 * achievements, custom stories, search history, time logs) to the backend, which stores them in
 * MongoDB and computes streaks / consistency from them.
 *
 *  - Events are queued in localStorage first, so closing the tab or losing the network never loses
 *    reading time; each carries a unique `opId`, so a retried batch can never be counted twice.
 *  - Nothing here ever throws into the UI: a failed send just stays queued and is retried.
 */
type TrackingEvent =
  | { type: "time"; opId: string; day: string; kind: "story" | "doc" | "reader"; itemId: string; title?: string; ms: number; opened?: boolean; at: string }
  | { type: "count"; opId: string; day: string; field: "testsTaken" | "storiesRead" | "docsRead"; inc: number };

const FLUSH_DELAY_MS = 3000;
const MAX_BLOB_CHARS = 1_500_000; // the API accepts 2 MB bodies; bigger values (e.g. a huge uploaded PDF) stay local only

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class BackendTracking {
  private userId: string | null = null;
  private events: TrackingEvent[] = [];
  private blobs = new Map<string, string>(); // feature -> latest raw string value
  private timer: number | null = null;
  private busy = false;

  private get queueKey(): string {
    return `srt:track:q:${this.userId}`;
  }

  /** Which signed-in user's data is being sent (null = nothing is sent). */
  setUser(userId: string | null): void {
    if (this.userId === userId) return;
    this.userId = userId;
    this.events = [];
    this.blobs.clear();
    if (userId && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(this.queueKey);
        if (raw) this.events = JSON.parse(raw) as TrackingEvent[];
      } catch { /* start empty */ }
      this.schedule();
    }
  }

  get activeUserId(): string | null {
    return this.userId;
  }

  trackTime(kind: "story" | "doc" | "reader", itemId: string, title: string, ms: number, opened: boolean): void {
    if (!this.userId || !(ms > 0)) return;
    this.push({ type: "time", opId: uid(), day: toDateKey(), kind, itemId, title, ms: Math.min(Math.round(ms), 6 * 3600_000), opened, at: new Date().toISOString() });
  }

  trackCount(field: "testsTaken" | "storiesRead" | "docsRead", inc = 1): void {
    if (!this.userId) return;
    this.push({ type: "count", opId: uid(), day: toDateKey(), field, inc });
  }

  /** The newest raw value for one stored feature (called whenever the app saves it locally). */
  queueBlob(userId: string, feature: string, raw: string): void {
    if (userId !== this.userId) return;
    if (raw.length > MAX_BLOB_CHARS) return;
    this.blobs.set(feature, raw);
    this.schedule();
  }

  private push(e: TrackingEvent): void {
    this.events.push(e);
    this.persistQueue();
    this.schedule();
  }

  private persistQueue(): void {
    try { window.localStorage.setItem(this.queueKey, JSON.stringify(this.events.slice(-2000))); } catch { /* best effort */ }
  }

  private schedule(): void {
    if (typeof window === "undefined" || !isApiEnabled() || this.timer !== null) return;
    this.timer = window.setTimeout(() => { this.timer = null; void this.flush(); }, FLUSH_DELAY_MS);
  }

  /** Send everything queued. Safe to call at any time (e.g. on tab hide). */
  async flush(): Promise<void> {
    if (this.busy || !this.userId || !isApiEnabled()) return;
    this.busy = true;
    const who = this.userId;
    try {
      const apiFetch = await api();
      while (this.events.length && this.userId === who) {
        const batch = this.events.slice(0, 100);
        await apiFetch("/tracking/events", { method: "POST", body: { events: batch } });
        this.events = this.events.slice(batch.length);
        this.persistQueue();
      }
      for (const [feature, raw] of Array.from(this.blobs)) {
        if (this.userId !== who) break;
        let value: unknown;
        try { value = JSON.parse(raw); } catch { value = { raw }; }
        await apiFetch(`/tracking/blobs/${feature}`, { method: "PUT", body: { value } });
        if (this.blobs.get(feature) === raw) this.blobs.delete(feature);
      }
    } catch {
      this.schedule(); // offline / server down: keep the queue and try again shortly
    } finally {
      this.busy = false;
    }
  }
}

export const backendTracking = new BackendTracking();

export interface ConsistencySummary {
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  totalMs: number;
  last30ActiveDays: number;
  todayActive: boolean;
}

/** The streak/consistency numbers MongoDB computed for the signed-in user (null if the backend is off/unreachable). */
export async function fetchConsistency(): Promise<ConsistencySummary | null> {
  if (!isApiEnabled()) return null;
  try {
    const apiFetch = await api();
    return await apiFetch<ConsistencySummary>("/tracking/summary", { query: { today: toDateKey() } });
  } catch {
    return null;
  }
}

export interface TrackingState {
  blobs: Record<string, { value: unknown; rev: number }>;
}
export async function fetchTrackingState(): Promise<TrackingState | null> {
  if (!isApiEnabled()) return null;
  try {
    const apiFetch = await api();
    return await apiFetch<TrackingState>("/tracking/state", { query: { today: toDateKey() } });
  } catch {
    return null;
  }
}
