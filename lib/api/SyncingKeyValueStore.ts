import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";
import { backendTracking } from "@/lib/api/backendTracking";

/** The per-user features that are mirrored to MongoDB (must match BLOB_KEYS in the backend). */
export const SYNCED_FEATURES: readonly string[] = ["history", "streak", "daily", "bookmarks", "achievements", "customStories", "searchHistory", "timelog", "doctime"];

/**
 * DECORATOR over any KeyValueStore: behaves exactly like the store it wraps, and additionally tells
 * the backend whenever one of the user's reading-data features is saved. The repositories (history,
 * streak, daily activity, bookmarks, ...) are unchanged — they don't know the backend exists.
 */
export class SyncingKeyValueStore implements KeyValueStore {
  constructor(private readonly inner: KeyValueStore) {}

  getItem(key: string): string | null {
    return this.inner.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.inner.setItem(key, value);
    const parsed = UserNamespace.parse(key);
    if (parsed && SYNCED_FEATURES.includes(parsed.feature)) backendTracking.queueBlob(parsed.userId, parsed.feature, value);
  }

  removeItem(key: string): void {
    this.inner.removeItem(key);
  }

  keys(): string[] {
    return this.inner.keys();
  }

  /**
   * First link of this browser to the backend. Per feature:
   *  - this browser has real data            -> upload it (the backend gets what you already had),
   *  - this browser has none, server has some -> restore it here (new device / cleared storage).
   * Returns true when something was restored (the caller reloads so every screen reads it).
   */
  reconcile(userId: string, serverBlobs: Record<string, { value: unknown }>): boolean {
    const ns = UserNamespace.forUser(userId);
    let restored = false;
    for (const feature of SYNCED_FEATURES) {
      const key = ns.key(feature);
      const local = this.inner.getItem(key);
      const server = serverBlobs[feature];
      if (local !== null && !isTrivial(local)) {
        backendTracking.queueBlob(userId, feature, local);
      } else if (server && !isTrivial(JSON.stringify(server.value))) {
        const v = server.value as { raw?: string } | null;
        const text = v && typeof v === "object" && typeof v.raw === "string" && Object.keys(v).length === 1 ? v.raw : JSON.stringify(server.value);
        this.inner.setItem(key, text);
        restored = true;
      }
    }
    return restored;
  }
}

/** "[]", "{}", null, or an object whose values are all empty/zero — i.e. nothing worth keeping. */
export function isTrivial(raw: string): boolean {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v === null || v === "" || v === 0) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).every((x) => x === null || x === 0 || x === "" || x === false || (Array.isArray(x) && x.length === 0) || (typeof x === "object" && x !== null && Object.keys(x).length === 0));
    return false;
  } catch {
    return raw.length === 0;
  }
}
