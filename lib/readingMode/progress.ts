/** Pure maths for the free-scroll reading mode (no DOM, unit-tested). */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Reading progress through an article that starts at `articleTop` (document
 * coordinates) and is `articleHeight` tall. The reading line sits 40% down
 * the viewport: progress is 0 when that line is at the article's top and 1
 * when the viewport's bottom edge reaches the article's bottom, moving
 * continuously in between.
 */
export function articleProgress(scrollY: number, viewportH: number, articleTop: number, articleHeight: number): number {
  if (articleHeight <= 0) return 0;
  const startY = Math.max(0, articleTop - viewportH * 0.4);
  const endY = articleTop + articleHeight - viewportH;
  if (endY <= startY) return scrollY >= startY ? 1 : 0;
  return clamp01((scrollY - startY) / (endY - startY));
}

/** Time left at `wpm` for an article of `words` words, given progress 0..1. */
export function timeLeftMs(words: number, wpm: number, progress: number): number {
  if (words <= 0 || wpm <= 0) return 0;
  return Math.max(0, (words / wpm) * 60_000 * (1 - clamp01(progress)));
}

/** One step of exponential easing toward `target` (the "inertia" of the smooth scroller). */
export function easeToward(current: number, target: number, factor = 0.11, epsilon = 0.4): number {
  const d = target - current;
  return Math.abs(d) < epsilon ? target : current + d * factor;
}

/** Reading-mode clock: counts down from words/wpm at real time, independent of scrolling. */
export function remainingMs(words: number, wpm: number, elapsedMs: number): number {
  if (words <= 0 || wpm <= 0) return 0;
  return Math.max(0, (words / wpm) * 60_000 - Math.max(0, elapsedMs));
}

/** Actual speed from how long the reading really took (whole story assumed read). */
export function wpmFromElapsed(words: number, elapsedMs: number): number {
  if (words <= 0 || elapsedMs <= 0) return 0;
  return Math.round(words / (elapsedMs / 60_000));
}
