"use client";

import { useEffect } from "react";
import { storage } from "@/lib/storage";

const TICK_MS = 1000;
const IDLE_MS = 120_000; // no scroll, key, pointer or touch for 2 minutes: the clock stops
const MIN_SAVE_MS = 3000;

/**
 * Adds the time the signed-in user spends on a documentation page to their time log (Profile → Time
 * spent). Only real reading time counts: the tab must be visible and the person must have done
 * something (scrolled, moved, typed) in the last two minutes. Nothing is saved for visits under 3 s.
 * Renders nothing.
 */
export function DocTimeTracker({ slug, title }: { slug: string; title: string }) {
  useEffect(() => {
    let pending = 0;
    let counted = false; // the first save of this page view is the visit
    let lastActivity = Date.now();
    let last = Date.now();

    const flush = () => {
      if (pending < MIN_SAVE_MS) return;
      storage.recordDocReading(slug, title, pending, !counted);
      counted = true;
      pending = 0;
    };
    const touch = () => { lastActivity = Date.now(); };
    const id = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastActivity < IDLE_MS) pending += now - last;
      last = now;
    }, TICK_MS);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };

    const events: Array<keyof WindowEventMap> = ["scroll", "pointermove", "keydown", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [slug, title]);

  return null;
}
