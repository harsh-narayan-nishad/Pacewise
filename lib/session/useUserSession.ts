"use client";

import { useSyncExternalStore } from "react";
import { sessionManager } from "@/lib/session/composition";
import { UserSession } from "@/lib/session/UserSession";

/** Changes whenever the signed-in user changes. */
export function useSessionVersion(): number {
  return useSyncExternalStore(sessionManager.subscribe, sessionManager.getVersion, sessionManager.getVersion);
}

/** Id of the active user (`guest` when signed out); re-renders on switch. */
export function useActiveUserId(): string {
  useSessionVersion();
  return sessionManager.activeUserId();
}

/** The active user's session object; re-renders on switch. */
export function useUserSession(): UserSession {
  useSessionVersion();
  return sessionManager.active();
}
