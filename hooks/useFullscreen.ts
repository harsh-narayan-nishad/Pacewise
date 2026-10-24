"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Extracted out of the Controls component so the new TopNav can offer its
 * own fullscreen button without duplicating the `requestFullscreen` /
 * `exitFullscreen` logic. Listens for `fullscreenchange` too, so the
 * button's icon stays correct if the user exits fullscreen via Esc or the
 * browser's own UI rather than our button.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}
