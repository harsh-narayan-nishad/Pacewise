"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Reader } from "@/components/Reader/Reader";
import { MediaReader } from "@/components/Reader/MediaReader";
import { Controls } from "@/components/Controls/Controls";
import { Speedometer } from "@/components/Speedometer/Speedometer";
import { BreakTimer } from "@/components/BreakTimer/BreakTimer";
import { useReadingState, useReadingDispatch } from "@/contexts/ReadingContext";
import { useReadingEngine } from "@/hooks/useReadingEngine";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAutoPause } from "@/hooks/useAutoPause";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useBreakTracker } from "@/hooks/useBreakTracker";
import {
  durationForWpm,
  effectiveWpm as computeEffectiveWpm,
  formatDuration,
  storyWordCount,
  wpmReductionPercent,
} from "@/lib/wpmCalculator";
import { storage } from "@/lib/storage";
import { PageLoader } from "@/components/ui/PageLoader";

export default function ReaderPage() {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null!);
  const viewportRef = useRef<HTMLDivElement>(null!);
  const { toggleFullscreen } = useFullscreen();
  // Guards the completion side effects below against firing twice — the
  // effect depends on values (actualWpm, breakTracker.*) that change on
  // nearly every render, but `state.phase` only flips to "completed" once
  // per reading session, and that's the one moment this should run.
  const completionHandledRef = useRef(false);

  useEffect(() => {
    if (!state.story) router.replace("/");
  }, [state.story, router]);

  const wordCount = state.story ? storyWordCount(state.story) : 0;
  const { restart, skipToEnd } = useReadingEngine(trackRef, viewportRef, wordCount);
  const media = state.story?.media;

  const isReadingPhase = state.phase === "reading";
  const breakTracker = useBreakTracker(isReadingPhase, state.isPlaying);

  const togglePlayPause = useCallback(() => {
    dispatch({ type: state.isPlaying ? "PAUSE" : "PLAY" });
  }, [dispatch, state.isPlaying]);

  const handleRestart = useCallback(() => {
    completionHandledRef.current = false;
    restart();
  }, [restart]);

  useKeyboardShortcuts({
    onPlayPause: togglePlayPause,
    onSpeedUp: () => dispatch({ type: "SET_WPM", wpm: state.selectedWpm + 25 }),
    onSpeedDown: () => dispatch({ type: "SET_WPM", wpm: state.selectedWpm - 25 }),
    onFullscreen: toggleFullscreen,
    onRestart: handleRestart,
    onEscape: () => document.exitFullscreen?.(),
  });

  useAutoPause(
    state.isPlaying,
    () => dispatch({ type: "PAUSE" }),
    () => dispatch({ type: "PLAY" })
  );

  const expectedDurationMs = durationForWpm(wordCount, state.selectedWpm);
  const msRemaining = Math.max(0, expectedDurationMs * (1 - state.progress));
  const wordsRemaining = Math.round(wordCount * (1 - state.progress));
  const actualWpm = state.actualWpmSamples.length
    ? state.actualWpmSamples[state.actualWpmSamples.length - 1]
    : state.selectedWpm;

  const actualDurationMs = state.startedAt ? Date.now() - state.startedAt : 0;

  // Live "effective WPM" / reduction, recomputed on every render — which
  // happens every second while paused thanks to useBreakTracker's ticker,
  // and every animation frame while playing thanks to the engine's own
  // progress updates. Words covered is frozen while paused (progress
  // doesn't move), so the growing wall-clock denominator is exactly what
  // makes the reduction hint climb in real time on a break.
  const wordsCovered = wordCount * state.progress;
  const liveEffectiveWpm = computeEffectiveWpm(wordsCovered, actualDurationMs);
  const liveReductionPercent = wpmReductionPercent(state.selectedWpm, liveEffectiveWpm);

  // The "Story completed" interstitial (stats + a "Continue to questions"
  // button the user had to click) is gone — finishing a story now flows
  // straight into the quiz (or straight to results, for a media story
  // with no questions) the instant the engine marks the session
  // "completed," with no page or click in between. Everything that
  // button used to do on click now runs here instead, once, guarded by
  // completionHandledRef so it can't double-fire while this effect's
  // other dependencies (actualWpm, breakTracker's live numbers) keep
  // changing on every render during the brief instant before the route
  // change actually takes effect.
  useEffect(() => {
    if (!state.story || state.phase !== "completed" || completionHandledRef.current) return;
    completionHandledRef.current = true;

    const finalEffectiveWpm = computeEffectiveWpm(wordCount, actualDurationMs);
    const finalReduction = wpmReductionPercent(state.selectedWpm, finalEffectiveWpm);

    dispatch({
      type: "SET_BREAK_STATS",
      stats: {
        totalBreakMs: breakTracker.sessionBreakMs,
        breakCount: breakTracker.breakCount,
        longestBreakMs: breakTracker.longestBreakMs,
        averageBreakMs: breakTracker.averageBreakMs,
      },
    });

    storage.bumpStreak();
    storage.recordStoryReading(state.story.id ?? state.story.title, state.story.title, Math.max(0, actualDurationMs - breakTracker.sessionBreakMs));
    storage.recordSession({
      minutes: Math.round(actualDurationMs / 60_000),
      wpm: Math.round(actualWpm),
      completed: true,
      breakMs: breakTracker.sessionBreakMs,
      breakCount: breakTracker.breakCount,
      effectiveWpm: finalEffectiveWpm,
      reductionPercent: finalReduction,
    });
    storage.addHistoryEntry({
      id: crypto.randomUUID(),
      title: state.story.title,
      date: new Date().toISOString(),
      wpm: Math.round(actualWpm),
      accuracy: 0,
      wordCount,
    });

    // A media story (uploaded PDF/image, see lib/mediaStory.ts) has no
    // comprehension questions to generate from a scanned page — skip the
    // quiz step entirely rather than sending the reader to an empty
    // questions screen. Routing through GO_TO_QUESTIONS with a count of 0
    // (instead of jumping straight to GO_TO_RESULTS) is deliberate: that
    // action is what resets `answers` to `[]`, which matters if a
    // previous story's quiz answers are still sitting in state from
    // earlier this session.
    const questionCount = state.story.questions.length;
    dispatch({ type: "GO_TO_QUESTIONS", quizQuestionCount: Math.min(5, questionCount) });
    if (questionCount === 0) {
      dispatch({ type: "GO_TO_RESULTS" });
      router.push("/results");
    } else {
      router.push("/questions");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  if (!state.story) return <PageLoader />;

  // Replaces the old second navbar (ProgressBar, previously docked under
  // TopNav) — that info now lives beside the Speedometer instead of in its
  // own glass bar. TopNav's own center slot still shows the live % and wpm
  // (see TopNav.tsx) on every breakpoint, so progress stays visible on
  // mobile even though this richer block is desktop-only (lg+, same
  // breakpoint as the Speedometer column itself).
  const currentUnit =
    media ? Math.min(media.pages.length - 1, Math.floor(state.progress * media.pages.length)) : state.currentParagraphIndex;
  const totalUnits = media ? media.pages.length : state.story.story.length;
  const unitLabel = media ? "Page" : "Paragraph";

  return (
    <div>
      {state.phase === "reading" && (
        <>
          {media ? (
            <MediaReader
              story={state.story}
              fonts={state.fonts}
              trackRef={trackRef}
              viewportRef={viewportRef}
              reserveSpeedometerColumn
            />
          ) : (
            <Reader
              story={state.story}
              fonts={state.fonts}
              trackRef={trackRef}
              viewportRef={viewportRef}
              reserveSpeedometerColumn
            />
          )}

          {/* Desktop: a dedicated 15vw column on the right (the reading
              viewport itself is clamped to the left 85vw — see
              Reader.tsx's `reserveSpeedometerColumn`), full height, with
              the Speedometer and — while paused — the break timer centered
              inside it. A real width split rather than an independent
              fixed offset, so this column and the reading column can
              never overlap regardless of screen width. */}
          <div className="pointer-events-none fixed right-0 top-0 z-20 hidden h-full w-[15vw] flex-col items-center justify-center gap-6 lg:flex">
            <Speedometer wpm={actualWpm} />

            {/* Relocated from the old second navbar (ProgressBar) — same
                data (unit counter, % complete, words/time remaining), now
                docked under the dial instead of its own top bar. */}
            <div className="pointer-events-auto flex w-40 flex-col items-center gap-1 rounded-xl border border-overlay/10 bg-canvas-raised px-3 py-2.5 text-center shadow-themed">
              <span className="text-xs text-ink-muted">
                {unitLabel} {Math.min(currentUnit + 1, totalUnits)} / {totalUnits}
              </span>
              <span className="font-mono text-sm text-ink">{Math.round(state.progress * 100)}%</span>
              <div className="h-1 w-full overflow-hidden rounded-full bg-overlay/10">
                <div
                  className="h-full rounded-full bg-accent-medium transition-[width] duration-150 ease-linear"
                  style={{ width: `${state.progress * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-ink-muted">
                {wordsRemaining} words · {formatDuration(msRemaining)} left
              </span>
            </div>

            <AnimatePresence>
              {breakTracker.isPaused && (
                <div className="pointer-events-auto">
                  <BreakTimer
                    currentBreakMs={breakTracker.currentBreakMs}
                    todayBreakMs={breakTracker.todayBreakMs}
                    reductionPercent={liveReductionPercent}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile / tablet: no reserved gutter exists below `lg`, so the
              break card centers itself as a lightweight modal-style
              overlay instead — an intentional, momentary pause moment
              rather than a docked sidebar element. */}
          <div className="pointer-events-none fixed inset-x-0 top-28 z-20 flex justify-center px-4 lg:hidden">
            <AnimatePresence>
              {breakTracker.isPaused && (
                <div className="pointer-events-auto">
                  <BreakTimer
                    currentBreakMs={breakTracker.currentBreakMs}
                    todayBreakMs={breakTracker.todayBreakMs}
                    reductionPercent={liveReductionPercent}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          <Controls
            isPlaying={state.isPlaying}
            wpm={state.selectedWpm}
            fonts={state.fonts}
            onPlayPause={togglePlayPause}
            onRestart={handleRestart}
            onSkip={() => skipToEnd()}
            onSpeedChange={(wpm) => dispatch({ type: "SET_WPM", wpm })}
            onFontsChange={(fonts) => dispatch({ type: "UPDATE_FONTS", fonts })}
          />
        </>
      )}

      {/* No more "Story completed" screen/button — the useEffect above
          fires the instant state.phase becomes "completed" and routes
          straight on to /questions or /results. This is just the brief,
          unavoidable instant between that phase flip and the route
          actually changing — same loader used for every other
          route-transition wait in this app (see PageLoader), not a new
          interstitial of its own. */}
      {state.phase === "completed" && <PageLoader />}
    </div>
  );
}
