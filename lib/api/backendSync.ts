import { apiFetch, ApiError } from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/config";
import { tokenStore } from "@/lib/api/tokenStore";
import * as endpoints from "@/lib/api/endpoints";
import { backendTracking, fetchTrackingState } from "@/lib/api/backendTracking";
import { SyncCollection, SyncOp, SyncRecordData, SYNC_COLLECTIONS, mayPush } from "@/lib/api/syncPolicy";
import { devDataStore } from "@/lib/devData/store";
import { syncingStore } from "@/lib/session/composition";

/**
 * Keeps MongoDB (through the backend) in step with what the person does in the app:
 *   likes/dislikes, comments, comment reactions, shares, saves, playlists, follows, notifications, avatars.
 *
 * How it works (deliberately small):
 *  - The app's existing logic still runs in the browser, so the UI stays instant.
 *  - Every local change is compared with a "baseline" (what the server already has). Anything new, changed
 *    or deleted that belongs to the signed-in user is sent to POST /sync/ops. The server re-checks ownership.
 *  - Every 15 s (and when the tab becomes visible again) it pulls GET /sync/snapshot, so other people's
 *    likes, comments, follows, shares and notifications appear here too.
 *  - If the backend is down nothing breaks: the diff is simply retried on the next change / poll.
 */
const POLL_MS = 15_000;
const PUSH_DELAY_MS = 400;
const BATCH = 200;

type Status = "off" | "connecting" | "online" | "offline";

class BackendSync {
  private userId: string | null = null;
  private baseline = new Map<string, string>();
  private seq = 0;
  private pushTimer: number | null = null;
  private pollTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private busy = false;
  private again = false;
  private status: Status = "off";
  private listeners = new Set<() => void>();

  // useSyncExternalStore-compatible status (for an optional "synced" indicator)
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getStatus = (): Status => this.status;
  private setStatus(s: Status): void {
    if (this.status === s) return;
    this.status = s;
    this.listeners.forEach((l) => l());
  }

  /** Sign this demo user in to the backend (same username + password as the demo login), then start syncing. */
  async connect(userId: string, username: string, password: string): Promise<boolean> {
    if (!isApiEnabled()) return false;
    this.setStatus("connecting");
    try {
      await endpoints.login({ identifier: username, password });
    } catch (err) {
      // 401 = the demo accounts were not seeded yet (npm run seed); anything else = backend unreachable.
      this.setStatus(err instanceof ApiError && err.status === 401 ? "off" : "offline");
      return false;
    }
    await this.start(userId);
    return true;
  }

  /** Start syncing for a user who already has backend tokens (e.g. after a page reload). */
  async start(userId: string): Promise<void> {
    if (!isApiEnabled() || !tokenStore.getAccessToken()) { this.setStatus("off"); return; }
    if (this.userId === userId && this.unsubscribe) return;
    this.stop();
    this.userId = userId;
    this.baseline = new Map();
    this.seq = 0;
    backendTracking.setUser(userId);
    this.unsubscribe = devDataStore.onLocalChange(() => this.schedulePush());
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisible);
    this.pollTimer = window.setInterval(() => void this.cycle(), POLL_MS);

    const firstTime = !this.flag(userId);
    try {
      if (firstTime) await this.push(); // brand-new link: upload what this browser already has
      await this.pull();
      if (!firstTime) await this.push();
      await this.restoreReadingData(userId);
      this.setFlag(userId);
      void backendTracking.flush();
      this.setStatus("online");
    } catch {
      this.setStatus("offline");
    }
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.pushTimer !== null) window.clearTimeout(this.pushTimer);
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    this.pushTimer = this.pollTimer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisible);
    this.userId = null;
    backendTracking.setUser(null);
    this.setStatus("off");
  }

  private onVisible = (): void => {
    if (document.visibilityState === "visible") void this.cycle();
    else void backendTracking.flush();
  };

  private async cycle(): Promise<void> {
    try {
      await this.push();
      await this.pull();
      this.setStatus("online");
    } catch {
      this.setStatus("offline");
    }
  }

  private schedulePush(): void {
    if (this.pushTimer !== null || !this.userId) return;
    this.pushTimer = window.setTimeout(() => {
      this.pushTimer = null;
      this.push().then(() => this.setStatus("online")).catch(() => this.setStatus("offline"));
    }, PUSH_DELAY_MS);
  }

  // --- push -----------------------------------------------------------------------------
  private diff(userId: string): { ops: SyncOp[]; marks: Map<string, string | null> } {
    const ops: SyncOp[] = [];
    const marks = new Map<string, string | null>(); // baseline key -> new baseline value (null = removed)
    const current = devDataStore.syncCollections();
    const seen = new Set<string>();
    for (const collection of SYNC_COLLECTIONS) {
      for (const rec of current[collection]) {
        const id = String(rec.id);
        const key = `${collection}:${id}`;
        seen.add(key);
        const json = JSON.stringify(rec);
        if (this.baseline.get(key) === json) continue;
        if (!mayPush(userId, collection, id, rec)) continue;
        ops.push({ op: "put", collection, id, data: rec });
        marks.set(key, json);
      }
    }
    for (const key of this.baseline.keys()) {
      if (seen.has(key)) continue;
      const sep = key.indexOf(":");
      const collection = key.slice(0, sep) as SyncCollection;
      const id = key.slice(sep + 1);
      let data: SyncRecordData = {};
      try { data = JSON.parse(this.baseline.get(key) as string) as SyncRecordData; } catch { /* keep {} */ }
      const allowed = collection === "avatars" ? id === userId : mayPush(userId, collection, id, data);
      if (!allowed) {
        marks.set(key, null); // not ours to delete — just forget it
        continue;
      }
      ops.push({ op: "delete", collection, id });
      marks.set(key, null);
    }
    return { ops, marks };
  }

  private async push(): Promise<void> {
    if (!this.userId) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      do {
        this.again = false;
        const userId = this.userId;
        if (!userId) return;
        const { ops, marks } = this.diff(userId);
        for (let i = 0; i < ops.length; i += BATCH) {
          const chunk = ops.slice(i, i + BATCH);
          await apiFetch("/sync/ops", { method: "POST", body: { ops: chunk } });
          for (const op of chunk) {
            const key = `${op.collection}:${op.id}`;
            const v = marks.get(key);
            if (v === null || v === undefined) this.baseline.delete(key);
            else this.baseline.set(key, v);
          }
        }
        // Records skipped by mayPush/forgotten deletes still need their baseline updated.
        for (const [key, v] of marks) if (v === null) this.baseline.delete(key);
      } while (this.again);
    } finally {
      this.busy = false;
    }
  }

  // --- pull -----------------------------------------------------------------------------
  private async pull(): Promise<void> {
    if (!this.userId) return;
    const snap = await apiFetch<{ seq: number; upserts: Partial<Record<SyncCollection, SyncRecordData[]>>; deletes: Partial<Record<SyncCollection, string[]>> }>(
      "/sync/snapshot",
      { query: { since: this.seq } }
    );
    const has = Object.values(snap.upserts).some((l) => l?.length) || Object.values(snap.deletes).some((l) => l?.length);
    if (has) {
      devDataStore.applyServerSnapshot(snap);
      for (const c of SYNC_COLLECTIONS) {
        snap.upserts[c]?.forEach((r) => this.baseline.set(`${c}:${String(r.id)}`, JSON.stringify(r)));
        snap.deletes[c]?.forEach((id) => this.baseline.delete(`${c}:${id}`));
      }
    }
    this.seq = Math.max(this.seq, snap.seq);
  }

  // --- reading data on a new device ---------------------------------------------------------------
  private async restoreReadingData(userId: string): Promise<void> {
    if (this.flag(userId)) return; // only on this browser's first link; afterwards local data is pushed as it changes
    const state = await fetchTrackingState();
    if (!state) return;
    if (syncingStore.reconcile(userId, state.blobs)) {
      // Repositories read storage on demand; a reload makes every screen pick the restored data up.
      if (typeof window !== "undefined") window.location.reload();
    }
  }

  private flag(userId: string): boolean {
    try { return window.localStorage.getItem(`srt:sync:init:${userId}`) === "1"; } catch { return false; }
  }
  private setFlag(userId: string): void {
    try { window.localStorage.setItem(`srt:sync:init:${userId}`, "1"); } catch { /* ignore */ }
  }
}

export const backendSync = new BackendSync();
