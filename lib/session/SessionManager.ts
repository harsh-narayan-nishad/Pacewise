import { StoryData } from "@/types";
import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";
import { UserSession } from "@/lib/session/UserSession";
import { LegacyDataMigrator } from "@/lib/session/LegacyDataMigrator";
import { IdentityProvider } from "@/lib/session/identity/IdentityProvider";

type Listener = () => void;

/**
 * SESSION REGISTRY + OBSERVER (+ the app's single instance — see
 * composition.ts).
 *
 * Responsibilities, and nothing more:
 *   1. Resolve *which* user is active (asks the injected IdentityProvider).
 *   2. Hand out that user's `UserSession`, creating it once and caching it
 *      (one session object per user id, reused thereafter).
 *   3. Tell subscribers when the active user changes, so React can
 *      re-render / remount (compatible with `useSyncExternalStore`).
 *
 * Every dependency (store, identity, migrator) arrives through the
 * constructor, so the manager is unit-testable with a MemoryKeyValueStore
 * and a fake identity — no browser, no framework.
 */
export class SessionManager {
  private readonly sessions = new Map<string, UserSession>();
  private readonly listeners = new Set<Listener>();
  private version = 0;
  private lastUserId: string;

  constructor(
    private readonly store: KeyValueStore,
    private readonly identity: IdentityProvider,
    private readonly migrator: LegacyDataMigrator = new LegacyDataMigrator(store)
  ) {
    this.lastUserId = this.resolveUserId();
    // Singleton for the page's lifetime: the subscription is intentionally
    // never released.
    this.identity.subscribe(() => this.onIdentityMaybeChanged());
  }

  // --- useSyncExternalStore plumbing (arrow props keep `this` bound) -------
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  // --- identity ------------------------------------------------------------
  /** Id of the user whose session is active (`guest` if nobody is). */
  activeUserId(): string {
    return this.resolveUserId();
  }

  private resolveUserId(): string {
    return UserNamespace.forUser(this.identity.currentUserId()).userId;
  }

  /** The dev store notifies on *every* mutation (likes, comments...), so
   *  only an actual change of user bumps this manager's version. */
  private onIdentityMaybeChanged(): void {
    const id = this.resolveUserId();
    if (id === this.lastUserId) return;
    this.lastUserId = id;
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  // --- sessions ------------------------------------------------------------
  /** The active user's session. Call it at use time (not once at import)
   *  so it always reflects who is signed in *now*. */
  active(): UserSession {
    return this.sessionFor(this.resolveUserId());
  }

  sessionFor(userId: string): UserSession {
    const namespace = UserNamespace.forUser(userId);
    const cached = this.sessions.get(namespace.userId);
    if (cached) return cached;
    // The first real user to start a session adopts any pre-session global
    // data (see LegacyDataMigrator) *before* its repositories first read.
    this.migrator.claimFor(namespace);
    const session = new UserSession(namespace, this.store);
    this.sessions.set(namespace.userId, session);
    return session;
  }

  /** Read-only lookup of an uploaded story by id across *all* users'
   *  libraries. Needed so a story someone shared (a notification only
   *  carries the content id) can open for the recipient; it grants no
   *  ownership — edit/delete still check the active user's own session. */
  findCustomStoryAnywhere(id: string): StoryData | undefined {
    const own = this.active().customStories.findById(id);
    if (own) return own;
    const ownerId = this.findCustomStoryOwner(id);
    return ownerId ? this.sessionFor(ownerId).customStories.findById(id) : undefined;
  }

  /** The id of the user whose personal library holds the uploaded story `id`
   *  (undefined for built-in stories). This is what makes "who posted this?"
   *  truthful: an upload belongs to whoever's library it lives in. */
  findCustomStoryOwner(id: string): string | undefined {
    if (this.active().customStories.findById(id)) return this.resolveUserId();
    const userIds = new Set<string>();
    this.store.keys().forEach((key) => {
      const parsed = UserNamespace.parse(key);
      if (parsed && parsed.feature === "customStories") userIds.add(parsed.userId);
    });
    for (const userId of Array.from(userIds)) {
      if (this.sessionFor(userId).customStories.findById(id)) return userId;
    }
    return undefined;
  }
}
