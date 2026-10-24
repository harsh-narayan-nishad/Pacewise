"use client";

import { useEffect, useRef } from "react";

/**
 * Uses the Page Visibility API to pause reading when the tab loses focus,
 * and remembers whether *we* paused it (vs. the user already having
 * paused) so we only auto-resume sessions we auto-paused.
 */
export function useAutoPause(isPlaying: boolean, onPause: () => void, onResume: () => void) {
  const weAutoPaused = useRef(false);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        if (isPlaying) {
          weAutoPaused.current = true;
          onPause();
        }
      } else if (weAutoPaused.current) {
        weAutoPaused.current = false;
        onResume();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isPlaying, onPause, onResume]);
}
