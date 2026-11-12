import { OFFLINE_DEMO_LOGINS } from "@/lib/api/offlineDemoLogins";
import { SEED_USERS } from "@/lib/devData/seedUsers";
import type { ApiUser } from "@/lib/api/types";

/**
 * Signing in as a built-in demo person WITHOUT the backend. It is only tried when the backend cannot be
 * reached (never when it answered "wrong password"). Such a session has no tokens: it lives in this browser only.
 */
const KEY = "pacewise.offlineSession";

export function getOfflineSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setOfflineSession(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.localStorage.setItem(KEY, userId);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session then simply does not survive a reload */
  }
}

/** The demo person for this username (or id) and password, or null. */
export function findOfflineDemoUser(identifier: string, password: string): ApiUser | null {
  const id = identifier.trim().toLowerCase();
  const hit = OFFLINE_DEMO_LOGINS.find((l) => (l.username.toLowerCase() === id || l.id.toLowerCase() === id) && l.password === password);
  return hit ? offlineUserFor(hit.id) : null;
}

export function offlineUserFor(userId: string): ApiUser | null {
  const seed = SEED_USERS.find((u) => u.id === userId);
  const login = OFFLINE_DEMO_LOGINS.find((l) => l.id === userId);
  if (!seed || !login) return null;
  return { id: seed.id, email: `${seed.username}@demo.pacewise.local`, username: seed.username, name: seed.name, interests: seed.interests, avatarUrl: null, emailVerified: true };
}
