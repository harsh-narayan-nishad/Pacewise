/**
 * ABSTRACTION (Dependency Inversion). The session layer needs exactly two
 * facts about authentication: *who is signed in right now* and *tell me
 * when that changes*. Depending on this interface — instead of on the dev
 * data store, or later the backend's JWT user — keeps the session layer
 * free of any auth implementation and lets the identity source change
 * without touching a single repository.
 */
export interface IdentityProvider {
  /** Stable id of the signed-in user, or null when nobody is. */
  currentUserId(): string | null;
  /** Subscribe to (possible) identity changes; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}
