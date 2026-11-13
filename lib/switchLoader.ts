"use client";

import { useSyncExternalStore } from "react";

/**
 * The full-screen page-switch loader with Mediconnect's circular loader (see TopNav, which draws it).
 * - "home": a reading page -> the landing page (logo click). Done when "/" shows with no story.
 * - "reading": the landing page or any list -> a reading page (story page, /reader, /read). Done when the
 *   address is `href`'s path and a story is loaded.
 */
export type SwitchKind = "home" | "reading";
export interface SwitchLoaderState {
  kind: SwitchKind;
  /** Address the switch goes to (path only). */
  path: string;
  /** When it started (ms, Date.now()), for the minimum time on screen. */
  at: number;
}

let current: SwitchLoaderState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startSwitchLoader(kind: SwitchKind, href: string): void {
  current = { kind, path: href.split(/[?#]/)[0] || "/", at: Date.now() };
  emit();
}

export function stopSwitchLoader(): void {
  if (!current) return;
  current = null;
  emit();
}

export function useSwitchLoader(): SwitchLoaderState | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
    () => null,
  );
}
