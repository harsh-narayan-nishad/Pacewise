"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useReadingState } from "@/contexts/ReadingContext";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import { HEARTBEAT_MS, readingPresence } from "@/lib/readingPresence";

const ACTIVITY_EVENTS = ["scroll", "wheel", "keydown", "pointerdown", "pointermove", "touchstart"] as const;

/** Wires the browser (activity, tab visibility, a 5-second heartbeat) into the ReadingPresence model. Renders nothing. */
export function PresenceTracker() {
  const user = useCurrentUser();
  const pathname = usePathname();
  const { isPlaying } = useReadingState();

  useEffect(() => {
    readingPresence.setUser(user?.id ?? null);
  }, [user?.id]);

  // The auto-scroll reader counts while it is actually playing; the article surfaces report themselves.
  useEffect(() => {
    readingPresence.setSurface("reader", pathname === "/reader" && isPlaying);
  }, [pathname, isPlaying]);

  useEffect(() => {
    const note = () => readingPresence.noteActivity(performance.now());
    const onVisibility = () => readingPresence.setVisible(document.visibilityState === "visible");
    const onHide = () => readingPresence.flush();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, note, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    onVisibility();
    note();
    const id = window.setInterval(() => readingPresence.heartbeat(performance.now()), HEARTBEAT_MS);
    return () => {
      window.clearInterval(id);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, note));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      readingPresence.flush();
    };
  }, []);

  return null;
}
