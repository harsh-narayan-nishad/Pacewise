"use client";

import { useEffect, useState } from "react";

const EVENTS = ["scroll", "wheel", "mousemove", "keydown", "touchstart", "pointerdown"] as const;

/** True after `ms` without any user activity, so the timer can fade out while someone reads. */
export function useIdleDim(ms = 2500, enabled = true): boolean {
  const [dim, setDim] = useState(false);
  useEffect(() => {
    if (!enabled) { setDim(false); return; }
    let timer = 0;
    const wake = () => {
      setDim(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setDim(true), ms);
    };
    wake();
    EVENTS.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      EVENTS.forEach((ev) => window.removeEventListener(ev, wake));
    };
  }, [ms, enabled]);
  return dim;
}
