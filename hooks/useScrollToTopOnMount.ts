"use client";

import { useEffect, useLayoutEffect } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Puts a freshly opened page at its top *before the first paint*, instantly.
 *
 * Why: the app sets `scroll-behavior: smooth` on <html>. Opening a story from a scrolled landing page
 * kept the old scroll offset (so the middle of the article showed first) and the router's own reset to
 * the top then glided up smoothly, which looked like a glitch. An explicit instant scroll in a layout
 * effect removes the flash; the router's later reset finds the page already at the top and does nothing.
 */
export function useScrollToTopOnMount(key: string): void {
  useIsoLayoutEffect(() => {
    const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    toTop();
    const id = window.requestAnimationFrame(toTop); // once more after the router's own scroll step
    return () => window.cancelAnimationFrame(id);
  }, [key]);
}
