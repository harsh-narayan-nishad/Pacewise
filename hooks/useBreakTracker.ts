"use client";

import { useEffect, useRef, useState } from "react";
import { storage } from "@/lib/storage";

export interface BreakTrackerResult {
  isPaused: boolean;
  /** Elapsed time of the *current* break, ticking every second. 0 when not paused. */
  currentBreakMs: number;
  /** Sum of every break in this reading session, including the one in progress. */
  sessionBreakMs: number;
  /** Completed + in-progress break count this session. */
  breakCount: number;
  longestBreakMs: number;
  averageBreakMs: number;
  /** Persisted break time for today (other sessions) + this session's, live. */
  todayBreakMs: number;
}

/**
 * Owns every number the "Production-Level Pause Experience" needs, so the
 * floating break timer, the WPM-reduction hint, and the final efficiency
 * report all read from one source instead of three components each doing
 * their own bookkeeping (which is exactly how "duplicate state" bugs and
 * drifting numbers happen).
 *
 * Contract:
 *  - `enabled` gates tracking to the active reading phase only — pausing
 *    on the dashboard or the results page isn't a "break."
 *  - `isPlaying` is the single input that starts/stops a break. On the
 *    false→true edge (resume) the in-flight break is finalized into the
 *    cumulative stats and *persisted* via storage.recordSession-adjacent
 *    bookkeeping is left to the caller (this hook stays storage-agnostic
 *    about the final per-session write so the reader page remains the
 *    one place that decides when a "session" is truly over).
 *  - Nothing here is ever reset by a subsequent pause: totals only grow,
 *    matching "never start from zero" in the brief.
 */
export function useBreakTracker(enabled: boolean, isPlaying: boolean): BreakTrackerResult {
  const [tick, setTick] = useState(0); // forces a re-render once per second while paused
  const [sessionBreakMs, setSessionBreakMs] = useState(0);
  const [breakCount, setBreakCount] = useState(0);
  const [longestBreakMs, setLongestBreakMs] = useState(0);

  const breakStartRef = useRef<number | null>(null);
  const wasPlayingRef = useRef(isPlaying);
  const todayBreakMsAtMountRef = useRef(0);

  useEffect(() => {
    todayBreakMsAtMountRef.current = storage.getTodayBreakMs();
  }, []);

  // Start / finalize a break on isPlaying transitions.
  useEffect(() => {
    if (!enabled) return;
    const wasPlaying = wasPlayingRef.current;
    wasPlayingRef.current = isPlaying;

    if (wasPlaying && !isPlaying) {
      // Reading -> paused: open a new break session.
      breakStartRef.current = Date.now();
    } else if (!wasPlaying && isPlaying && breakStartRef.current != null) {
      // Paused -> reading: close it out and fold into cumulative stats.
      const duration = Date.now() - breakStartRef.current;
      breakStartRef.current = null;
      setSessionBreakMs((prev) => prev + duration);
      setBreakCount((prev) => prev + 1);
      setLongestBreakMs((prev) => Math.max(prev, duration));
    }
  }, [enabled, isPlaying]);

  // Live 1s ticker while on a break, so the floating timer and the
  // reduction hint animate in real time without a rAF loop (a plain
  // interval is plenty precise for a whole-second display).
  useEffect(() => {
    if (!enabled || isPlaying) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [enabled, isPlaying]);

  // Guard against losing an in-flight break if the session ends (e.g. the
  // user hits Skip) while still on a break — otherwise that time would
  // silently vanish from the session totals instead of being folded in.
  const enabledRef = useRef(enabled);
  useEffect(() => {
    const wasEnabled = enabledRef.current;
    enabledRef.current = enabled;
    if (wasEnabled && !enabled && breakStartRef.current != null) {
      const duration = Date.now() - breakStartRef.current;
      breakStartRef.current = null;
      setSessionBreakMs((prev) => prev + duration);
      setBreakCount((prev) => prev + 1);
      setLongestBreakMs((prev) => Math.max(prev, duration));
    }
  }, [enabled]);

  const isPaused = enabled && !isPlaying && breakStartRef.current != null;
  const currentBreakMs = isPaused && breakStartRef.current ? Date.now() - breakStartRef.current : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` exists purely to force this recompute every second
  void tick;

  const liveSessionBreakMs = sessionBreakMs + currentBreakMs;
  const liveBreakCount = breakCount + (isPaused ? 1 : 0);
  const liveLongest = Math.max(longestBreakMs, currentBreakMs);
  const averageBreakMs = liveBreakCount > 0 ? liveSessionBreakMs / liveBreakCount : 0;

  return {
    isPaused,
    currentBreakMs,
    sessionBreakMs: liveSessionBreakMs,
    breakCount: liveBreakCount,
    longestBreakMs: liveLongest,
    averageBreakMs,
    todayBreakMs: todayBreakMsAtMountRef.current + liveSessionBreakMs,
  };
}
