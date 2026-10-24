"use client";

import { useEffect } from "react";
import { easeToward } from "@/lib/readingMode/progress";

export const INERTIA_SCROLL_TO = "sr-inertia-to";

/** Smoothly scrolls the reading-mode page to `y` (document px), with the same inertia as the wheel. */
export function inertiaScrollTo(y: number): void {
  window.dispatchEvent(new CustomEvent(INERTIA_SCROLL_TO, { detail: y }));
}

/** True when the wheel is over an inner scroller (e.g. the section list) that can still move in that direction. */
function innerScrollerCanMove(start: HTMLElement | null, dy: number): boolean {
  for (let n = start; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(n).overflowY) || n.scrollHeight <= n.clientHeight + 1) continue;
    const atTop = n.scrollTop <= 0;
    const atBottom = n.scrollTop + n.clientHeight >= n.scrollHeight - 1;
    if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return true;
  }
  return false;
}

/** Wheel over a fixed overlay (modal, drawer, menu): never hijack it. */
function insideFixed(start: HTMLElement | null): boolean {
  for (let n = start; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (getComputedStyle(n).position === "fixed") return true;
  }
  return false;
}

/**
 * Wheel / keyboard scrolling with inertia: input moves a *target*, and the
 * real scroll position eases toward it every frame, so a flick glides and
 * settles instead of jumping. Touch scrolling keeps the browser's native
 * momentum, and nothing is hijacked when the user prefers reduced motion.
 */
export function useInertiaScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let target = window.scrollY;
    let current = target;
    let raf = 0;
    let animating = false;

    const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clamp = (y: number) => Math.min(maxY(), Math.max(0, y));
    const put = (y: number) => window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });

    const step = () => {
      current = easeToward(current, target);
      put(current);
      if (current === target) { animating = false; return; }
      raf = requestAnimationFrame(step);
    };
    const moveBy = (dy: number) => {
      if (!animating) { target = window.scrollY; current = target; }
      target = clamp(target + dy);
      if (!animating) { animating = true; raf = requestAnimationFrame(step); }
    };
    const moveTo = (y: number) => moveBy(clamp(y) - (animating ? target : window.scrollY));

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // pinch-zoom / sideways: leave native
      if (insideFixed(e.target as HTMLElement | null)) return;
      if (innerScrollerCanMove(e.target as HTMLElement | null, e.deltaY)) return; // let lists / code blocks scroll themselves
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      moveBy(e.deltaY * unit);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      const vh = window.innerHeight;
      let dy: number | null = null;
      if (e.key === "ArrowDown") dy = 70;
      else if (e.key === "ArrowUp") dy = -70;
      else if (e.key === "PageDown" || (e.key === " " && !e.shiftKey)) dy = vh * 0.9;
      else if (e.key === "PageUp" || (e.key === " " && e.shiftKey)) dy = -vh * 0.9;
      else if (e.key === "Home") dy = -maxY();
      else if (e.key === "End") dy = maxY();
      if (dy === null) return;
      e.preventDefault();
      moveBy(dy);
    };
    const onTo = (e: Event) => moveTo((e as CustomEvent<number>).detail);

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener(INERTIA_SCROLL_TO, onTo);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(INERTIA_SCROLL_TO, onTo);
    };
  }, [enabled]);
}
