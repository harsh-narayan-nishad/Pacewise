"use client";

import { useSyncExternalStore } from "react";
import { devDataStore } from "@/lib/devData/store";
import { DevUser } from "@/lib/devData/types";

/**
 * Thin React binding over the in-memory `devDataStore` (see store.ts's
 * header for why it's in-memory rather than localStorage/a real backend).
 *
 * `useSyncExternalStore` is the correct primitive here rather than a
 * second copy of the data in `useState`: the store is genuinely external
 * to React (a plain module-level class instance shared by every
 * component), and several unrelated components (NotificationBell,
 * CommentPanel, StoryCard's like button, the Hamburger menu's playlists)
 * all need to re-render the instant *any* of them mutates it — exactly
 * the cross-component consistency problem `useSyncExternalStore` exists
 * to solve.
 *
 * `useDevStoreVersion()` returns the store's internal version counter,
 * which changes on every mutation. Components read actual data via the
 * store's own `listX()`/`getX()` methods inside a `useMemo` keyed on this
 * version (see components that import this hook for the pattern) —
 * avoids re-deriving filtered lists on every unrelated render while still
 * staying perfectly in sync with the store.
 */
export function useDevStoreVersion(): number {
  return useSyncExternalStore(devDataStore.subscribe, devDataStore.getVersion, devDataStore.getVersion);
}

/** The logged-in development user, live-updated on login/logout from
 *  anywhere in the tree (see components/Auth/DevLoginGate.tsx). */
export function useCurrentUser(): DevUser | null {
  useDevStoreVersion();
  return devDataStore.getCurrentUser();
}
