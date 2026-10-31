"use client";

import { useEffect, useRef } from "react";
import { pushToast } from "@/lib/toastBus";

/**
 * Raises one alert the moment the reading clock reaches 0 and goes into overtime. It re-arms when the
 * clock is back under the target (a new story, a different speed, a restart), so it never repeats while
 * the overtime counter keeps running.
 */
export function useOvertimeAlert(overtime: boolean, enabled: boolean): void {
  const fired = useRef(false);
  useEffect(() => {
    if (!enabled || !overtime) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    pushToast("error", "Time's up at your chosen speed. The clock now counts how late you are.");
  }, [overtime, enabled]);
}
