import { SpeedBand, StoryData } from "@/types";

/**
 * All reading-speed math lives here, deliberately isolated from React.
 * Strategy pattern: the reading engine hook depends only on these pure
 * functions, so the math can be unit-tested and swapped (e.g. for a
 * non-linear easing curve) without touching component code.
 */

export function countWords(story: StoryData["story"]): number {
  return story.reduce((sum, p) => sum + p.paragraph.trim().split(/\s+/).filter(Boolean).length, 0);
}

/** The one place every caller should get "how many words is this story"
 *  from, instead of calling `countWords(story.story)` directly — a story
 *  built from an uploaded PDF/image (see lib/mediaStory.ts) has no real
 *  paragraphs to count (`story.story` is `[]`), and uses its media's own
 *  `estimatedWordCount` instead so the exact same WPM-based timing math
 *  everywhere (duration, effective-WPM, dashboard stats) keeps working
 *  unchanged for both content types. */
export function storyWordCount(story: StoryData): number {
  return story.media ? story.media.estimatedWordCount : countWords(story.story);
}

/** Total reading duration, in milliseconds, for a given word count and WPM. */
export function durationForWpm(wordCount: number, wpm: number): number {
  const safeWpm = Math.max(wpm, 1);
  return (wordCount / safeWpm) * 60_000;
}

/**
 * Pixels-per-second scroll velocity so that a track of `trackHeightPx`
 * finishes exactly when the reading duration elapses.
 */
export function scrollVelocity(trackHeightPx: number, durationMs: number): number {
  const seconds = Math.max(durationMs / 1000, 0.001);
  return trackHeightPx / seconds;
}

export function speedBand(wpm: number): SpeedBand {
  if (wpm < 200) return "slow";
  if (wpm < 300) return "medium";
  if (wpm < 450) return "fast";
  return "extreme";
}

export const SPEED_BAND_COLOR: Record<SpeedBand, string> = {
  slow: "#5FA8D3",
  medium: "#7FC97F",
  fast: "#E8B84B",
  extreme: "#E05B5B",
};

export const WPM_PRESETS = [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000] as const;

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Zero-padded HH:MM:SS (or MM:SS under an hour) — used by the break
 *  timer and efficiency report, where a consistent width matters because
 *  the value updates every second and shouldn't reflow. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Compact "5m 12s" / "1h 04m" style, distinct from formatClock's colon
 *  format — used where duration appears as inline tooltip/label text
 *  (the contribution calendar) rather than a ticking clock display. */
export function formatShortDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function performanceRating(accuracy: number): "Excellent" | "Good" | "Average" | "Needs Practice" {
  if (accuracy >= 90) return "Excellent";
  if (accuracy >= 75) return "Good";
  if (accuracy >= 50) return "Average";
  return "Needs Practice";
}

/**
 * Words actually covered by the scroll (0..wordCount) at a given progress,
 * over the full wall-clock time elapsed since the session started
 * (crucially including any time spent paused). This is what makes the
 * "effective" WPM organically drop while the reader is on a break: the
 * numerator is frozen (scroll doesn't move while paused) but the
 * denominator keeps growing every second.
 */
export function effectiveWpm(wordsCovered: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return wordsCovered / (elapsedMs / 60_000);
}

/** ((selected - effective) / selected) * 100, clamped to [0, 100], 1 decimal. */
export function wpmReductionPercent(selectedWpm: number, effWpm: number): number {
  if (selectedWpm <= 0) return 0;
  const raw = ((selectedWpm - effWpm) / selectedWpm) * 100;
  return Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
}

/** Simple complement of the reduction — not a validated psychometric
 *  score, just a single readable number for the report card. */
export function readingEfficiencyScore(reductionPercent: number): number {
  return Math.round(Math.min(100, Math.max(0, 100 - reductionPercent)));
}

export function readingEfficiencySummary(reductionPercent: number, breakCount: number): string {
  if (breakCount === 0 || reductionPercent < 3) {
    return "Excellent consistency. Almost no interruptions.";
  }
  if (reductionPercent < 10) {
    return "Good reading flow with a few short breaks.";
  }
  if (reductionPercent < 25) {
    return `Frequent pauses reduced your effective reading speed by ${reductionPercent.toFixed(1)}%.`;
  }
  return "Consider lowering the selected WPM for better comprehension.";
}
