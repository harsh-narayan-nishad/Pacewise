import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";

const ACCESS = "apiAccessToken";
const REFRESH = "apiRefreshToken";

/** Where tokens lived before they were per-user: one pair for the whole
 *  browser. */
const LEGACY_ACCESS_KEY = "speed-reader:api:accessToken";
const LEGACY_REFRESH_KEY = "speed-reader:api:refreshToken";

/**
 * Backend (JWT) tokens, scoped to the signed-in demo user.
 *
 * Why this is its own class and not a plain repository: tokens are
 * security-sensitive and have their own lifecycle (short-lived access
 * token, long-lived refresh token, cleared together on logout), but they
 * must obey the same isolation rule as every other piece of user data. If
 * they stayed browser-wide, user B signing in after user A on the same
 * browser would inherit A's backend account — and B's reading sessions
 * would be synced into A's history on the server.
 *
 * ENCAPSULATION: callers only see get/set/clear; the namespaced keys, the
 * guest-adoption rule and the legacy-key migration are private.
 * DEPENDENCY INVERSION: storage and "who is active" are injected, so this
 * is testable without a browser or the dev login.
 *
 * ADOPTION: the login screen lets someone connect a backend account
 * *before* picking a demo persona, so those tokens are first stored in the
 * `guest` slot. The first real user to read tokens with none of their own
 * adopts them (moved, not copied — so a second user can't also get them).
 * Pre-session builds' browser-wide tokens are adopted the same way.
 */
export class ScopedTokenStore {
  constructor(
    private readonly store: KeyValueStore,
    private readonly activeUserId: () => string
  ) {}

  private namespace(): UserNamespace {
    return UserNamespace.forUser(this.activeUserId());
  }

  private adoptPendingTokens(ns: UserNamespace): void {
    if (ns.isGuest || this.store.getItem(ns.key(ACCESS)) !== null) return;

    const guest = UserNamespace.forUser(null);
    const sources: Array<{ access: string; refresh: string }> = [
      { access: guest.key(ACCESS), refresh: guest.key(REFRESH) },
      { access: LEGACY_ACCESS_KEY, refresh: LEGACY_REFRESH_KEY },
    ];
    for (const source of sources) {
      const access = this.store.getItem(source.access);
      if (access === null) continue;
      this.store.setItem(ns.key(ACCESS), access);
      const refresh = this.store.getItem(source.refresh);
      if (refresh !== null) this.store.setItem(ns.key(REFRESH), refresh);
      this.store.removeItem(source.access);
      this.store.removeItem(source.refresh);
      return;
    }
  }

  getAccessToken(): string | null {
    const ns = this.namespace();
    this.adoptPendingTokens(ns);
    return this.store.getItem(ns.key(ACCESS));
  }

  getRefreshToken(): string | null {
    const ns = this.namespace();
    this.adoptPendingTokens(ns);
    return this.store.getItem(ns.key(REFRESH));
  }

  setTokens(accessToken: string, refreshToken: string): void {
    const ns = this.namespace();
    this.store.setItem(ns.key(ACCESS), accessToken);
    this.store.setItem(ns.key(REFRESH), refreshToken);
  }

  setAccessToken(accessToken: string): void {
    this.store.setItem(this.namespace().key(ACCESS), accessToken);
  }

  /** Clears the *active user's* tokens only. */
  clear(): void {
    const ns = this.namespace();
    this.store.removeItem(ns.key(ACCESS));
    this.store.removeItem(ns.key(REFRESH));
  }
}
