"use client";

import { useSyncExternalStore } from "react";
import { PresenceSnapshot, readingPresence } from "@/lib/readingPresence";

const SERVER: PresenceSnapshot = { status: "idle", totalMs: 0 };

/** Live reading status and the signed-in user's total reading time. */
export function useReadingPresence(): PresenceSnapshot {
  return useSyncExternalStore(readingPresence.subscribe, readingPresence.getSnapshot, () => SERVER);
}
