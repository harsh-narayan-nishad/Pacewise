const ROOT = "srt:v2:u:";

/**
 * VALUE OBJECT (immutable, compared by value) + ENCAPSULATION of the key
 * scheme.
 *
 * A namespace answers one question — "which storage keys belong to this
 * user?" — and is the *only* place the key format is known. Every
 * repository asks its namespace for a key (`namespace.key("history")`)
 * instead of building strings itself, which is what makes two users'
 * data structurally unable to collide: `srt:v2:u:user-1:history` and
 * `srt:v2:u:user-2:history` are different keys by construction.
 */
export class UserNamespace {
  static readonly GUEST_ID = "guest";

  private constructor(readonly userId: string) {}

  /** Private constructor + static factory: a blank/undefined id can never
   *  produce an un-namespaced key, it deterministically becomes `guest`. */
  static forUser(userId: string | null | undefined): UserNamespace {
    const trimmed = userId?.trim();
    return new UserNamespace(trimmed ? trimmed : UserNamespace.GUEST_ID);
  }

  /** Inverse of `key()`: which user + feature does a raw storage key
   *  belong to? Returns null for keys outside the session scheme. */
  static parse(storageKey: string): { userId: string; feature: string } | null {
    if (!storageKey.startsWith(ROOT)) return null;
    const rest = storageKey.slice(ROOT.length);
    const sep = rest.indexOf(":");
    if (sep <= 0) return null;
    try {
      return { userId: decodeURIComponent(rest.slice(0, sep)), feature: rest.slice(sep + 1) };
    } catch {
      return null;
    }
  }

  get isGuest(): boolean {
    return this.userId === UserNamespace.GUEST_ID;
  }

  get prefix(): string {
    return `${ROOT}${encodeURIComponent(this.userId)}:`;
  }

  key(feature: string): string {
    return `${this.prefix}${feature}`;
  }

  owns(storageKey: string): boolean {
    return storageKey.startsWith(this.prefix);
  }

  equals(other: UserNamespace): boolean {
    return this.userId === other.userId;
  }
}
