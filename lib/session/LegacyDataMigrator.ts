import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";

/** Pre-session builds wrote one global, un-namespaced key per feature. */
const LEGACY_KEYS = {
  history: "srt:history",
  streak: "srt:streak",
  lastReadDate: "srt:lastReadDate",
  bookmarks: "srt:bookmarks",
  achievements: "srt:achievements",
  daily: "srt:daily",
  customStories: "srt:customStories",
  searchHistory: "srt:searchHistory",
} as const;

/** Features whose legacy value can be copied verbatim (same JSON shape). */
const VERBATIM_FEATURES = ["history", "bookmarks", "achievements", "daily", "customStories", "searchHistory"] as const;

/**
 * One-time, loss-free move of the old global data into a user's namespace.
 *
 * Before sessions existed, everything on this browser was one shared pool.
 * Rather than silently dropping that history, the *first real (non-guest)
 * user to start a session claims it*; the legacy keys are then deleted and
 * a flag records who claimed them, so no second user can inherit the same
 * data and a re-run is a no-op. Never overwrites a destination key that
 * already holds data.
 */
export class LegacyDataMigrator {
  static readonly CLAIM_FLAG = "srt:v2:legacy-claimed-by";

  constructor(private readonly store: KeyValueStore) {}

  hasBeenClaimed(): boolean {
    return this.store.getItem(LegacyDataMigrator.CLAIM_FLAG) !== null;
  }

  private hasLegacyData(): boolean {
    return Object.values(LEGACY_KEYS).some((key) => this.store.getItem(key) !== null);
  }

  /** Returns true if legacy data was moved into `namespace`. */
  claimFor(namespace: UserNamespace): boolean {
    if (namespace.isGuest || this.hasBeenClaimed()) return false;
    if (!this.hasLegacyData()) {
      // Nothing to move — still record the claim so a later user can't
      // inherit data that some other tab writes under a legacy key.
      this.store.setItem(LegacyDataMigrator.CLAIM_FLAG, namespace.userId);
      return false;
    }

    VERBATIM_FEATURES.forEach((feature) => {
      const value = this.store.getItem(LEGACY_KEYS[feature]);
      if (value !== null && this.store.getItem(namespace.key(feature)) === null) {
        this.store.setItem(namespace.key(feature), value);
      }
    });
    this.migrateStreak(namespace);

    Object.values(LEGACY_KEYS).forEach((key) => this.store.removeItem(key));
    this.store.setItem(LegacyDataMigrator.CLAIM_FLAG, namespace.userId);
    return true;
  }

  /** The legacy streak lived in two keys; the new repository keeps one
   *  `{count, lastReadDate}` record, so this is the one non-verbatim move. */
  private migrateStreak(namespace: UserNamespace): void {
    const countRaw = this.store.getItem(LEGACY_KEYS.streak);
    const dateRaw = this.store.getItem(LEGACY_KEYS.lastReadDate);
    if ((countRaw === null && dateRaw === null) || this.store.getItem(namespace.key("streak")) !== null) return;
    try {
      const count = countRaw === null ? 0 : (JSON.parse(countRaw) as number);
      const lastReadDate = dateRaw === null ? null : (JSON.parse(dateRaw) as string | null);
      this.store.setItem(namespace.key("streak"), JSON.stringify({ count, lastReadDate }));
    } catch {
      /* corrupt legacy streak — start fresh rather than fail the session */
    }
  }
}
