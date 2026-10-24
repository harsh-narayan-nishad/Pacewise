"use client";

import { useCallback, useEffect, useRef } from "react";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import { durationForWpm } from "@/lib/wpmCalculator";

/**
 * Drives the bottom-to-top auto-scroll for the reading-practice screen.
 *
 * Note: an earlier version of this hook also computed a per-paragraph
 * "mute" reveal effect here (dimming/blurring not-yet-read text) from the
 * same per-frame scroll position. That effect — and, before it, a GSAP
 * ScrollTrigger-based attempt at the same idea — has been removed per
 * feedback; this hook now does exactly one job again: advance `progress`
 * and apply it as a real `scrollTop`.
 *
 * Design choice: requestAnimationFrame + real `scrollTop` on a dedicated
 * viewport element, not a CSS transform and not a CSS @keyframes
 * animation.
 *   - rAF gives per-frame control so Play/Pause/speed-change can mutate
 *     velocity instantly without restarting an animation (a CSS animation
 *     would need to be torn down and rebuilt on every WPM change, causing
 *     a visible jump).
 *   - Real `scrollTop` (rather than a `transform`, used by an even
 *     earlier version of this hook) fires genuine scroll events, which
 *     matters for anything downstream that might listen for them (and is
 *     simply the more conventional way to move a scroll position).
 *     `viewportRef` is rendered with `overflow-hidden` rather than
 *     `scroll`/`auto` specifically so this hook can still move it with
 *     plain `scrollTop` assignments (which still work under `overflow:
 *     hidden`) while the reader can never drag/wheel/touch it out of sync
 *     with the timed pace by hand.
 *
 * Progress-engine fix: earlier versions accumulated the scrolled distance
 * in **pixels** (`offsetPx`) and derived the displayed percentage as
 * `offsetPx / trackHeight`. That's backwards for a track whose height
 * changes live — changing content width, font size, line height, or
 * letter spacing all reflow the text and change `scrollHeight`, so a
 * pixel offset calibrated against the *old* height suddenly means a
 * different, visibly-jumping percentage against the *new* one.
 *
 * The fix makes **progress** (0..1, a fraction of the timed reading
 * duration) the source of truth, advanced by `dt / durationSeconds` every
 * frame, completely independent of content geometry. The pixel scroll
 * offset is then *derived* fresh every frame as `progress *
 * currentTrackHeight`. Consequence: `progress` — and therefore the
 * percentage shown in ProgressBar/TopNav — never depends on and never
 * glitches from a content reflow; only the derived pixel position
 * recalculates, snapping the scroll to the equivalent position in the
 * newly-laid-out text with no discontinuity in the number the user is
 * reading.
 */
export function useReadingEngine(
  trackRef: React.RefObject<HTMLDivElement>,
  viewportRef: React.RefObject<HTMLDivElement>,
  wordCount: number
) {
  const state = useReadingState();
  const dispatch = useReadingDispatch();

  const rafId = useRef<number | null>(null);
  const progressRef = useRef(0); // 0..1, the one authoritative "how far through" value
  const lastFrameTime = useRef<number | null>(null);
  const wpmSampleWindow = useRef<{ t: number; words: number }[]>([]);

  const trackHeight = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 0;
    // Distance to travel = content height minus one viewport height, so the
    // last line ends centered rather than scrolling fully off-screen.
    // Read live on every call (never cached) — this is exactly the value
    // that changes when content width/font size/line height/letter
    // spacing change, so re-reading it is what keeps progress accurate
    // through a reflow instead of trusting a stale measurement.
    const viewport = viewportRef.current?.clientHeight ?? 0;
    return Math.max(0, el.scrollHeight - viewport);
  }, [trackRef, viewportRef]);

  const applyScroll = useCallback(
    (progress: number) => {
      const distance = trackHeight();
      const offsetPx = progress * distance;
      if (viewportRef.current) {
        viewportRef.current.scrollTop = offsetPx;
      }
      return distance;
    },
    [trackHeight, viewportRef]
  );

  const tick = useCallback(
    (now: number) => {
      if (!state.isPlaying) return;
      if (lastFrameTime.current == null) lastFrameTime.current = now;
      const dt = (now - lastFrameTime.current) / 1000;
      lastFrameTime.current = now;

      const durationMs = durationForWpm(wordCount, state.selectedWpm);
      const durationSec = Math.max(durationMs / 1000, 0.001);
      progressRef.current = Math.min(1, progressRef.current + dt / durationSec);

      applyScroll(progressRef.current);

      const paragraphIndex = Math.floor(progressRef.current * (state.story?.story.length ?? 1));
      dispatch({ type: "SET_PROGRESS", progress: progressRef.current, paragraphIndex });

      // rolling actual-WPM sample for the speedometer / stats
      wpmSampleWindow.current.push({ t: now, words: wordCount * progressRef.current });
      wpmSampleWindow.current = wpmSampleWindow.current.filter((s) => now - s.t < 4000);
      if (wpmSampleWindow.current.length > 1) {
        const first = wpmSampleWindow.current[0];
        const last = wpmSampleWindow.current[wpmSampleWindow.current.length - 1];
        const dWords = last.words - first.words;
        const dSeconds = (last.t - first.t) / 1000;
        if (dSeconds > 0.3) {
          dispatch({ type: "SAMPLE_WPM", wpm: Math.round((dWords / dSeconds) * 60) });
        }
      }

      if (progressRef.current >= 1) {
        dispatch({ type: "COMPLETE" });
        rafId.current = null;
        return;
      }

      rafId.current = requestAnimationFrame(tick);
    },
    [state.isPlaying, state.selectedWpm, state.story, wordCount, applyScroll, dispatch]
  );

  useEffect(() => {
    if (state.isPlaying) {
      lastFrameTime.current = null;
      rafId.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, state.selectedWpm]);

  // Re-derive the pixel scroll offset (never the progress fraction itself)
  // whenever a reading-customization setting that can reflow the track
  // changes, so the scroll position visually catches up to the current
  // progress immediately instead of waiting for the next tick — this is
  // the "changing any reading customization should immediately
  // recalculate progress without glitches" requirement. A ResizeObserver
  // on the track covers every cause of a height change in one place
  // (content width, font size, line height, letter spacing, and window
  // resizing itself) rather than listening to each font setting
  // individually.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      applyScroll(progressRef.current);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [trackRef, applyScroll]);

  useEffect(() => {
    applyScroll(progressRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.story, wordCount]);

  const restart = useCallback(() => {
    progressRef.current = 0;
    wpmSampleWindow.current = [];
    applyScroll(0);
    dispatch({ type: "RESTART" });
  }, [dispatch, applyScroll]);

  const skipToEnd = useCallback(() => {
    progressRef.current = 1;
    applyScroll(1);
    dispatch({ type: "COMPLETE" });
  }, [dispatch, applyScroll]);

  return { restart, skipToEnd };
}
