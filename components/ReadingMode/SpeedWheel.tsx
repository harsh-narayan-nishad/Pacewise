"use client";

import React, { useMemo } from "react";
import OptionWheel from "@/components/ui/OptionWheel";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import { WPM_PRESETS } from "@/lib/wpmCalculator";

/**
 * Left-edge speed picker for the story page: scroll/drag the wheel to choose any reading speed.
 * The navbar shows how long the whole story takes at that speed (a fixed estimate — scrolling the
 * page never changes it).
 */
export function SpeedWheel() {
  const { selectedWpm } = useReadingState();
  const dispatch = useReadingDispatch();

  // The presets, plus the current speed if it was typed in somewhere else.
  const speeds = useMemo(() => {
    const all = new Set<number>(WPM_PRESETS);
    if (selectedWpm >= 50 && selectedWpm <= 1000) all.add(selectedWpm);
    return Array.from(all).sort((a, b) => a - b);
  }, [selectedWpm]);
  const items = useMemo(() => speeds.map(String), [speeds]);
  const index = Math.max(0, speeds.indexOf(selectedWpm));

  return (
    <div className="fixed left-0 top-1/2 z-30 hidden h-80 w-44 -translate-y-1/2 lg:block" role="group" aria-label="Reading speed">
      <div className="absolute left-6 top-0 text-[11px] font-medium uppercase tracking-widest text-ink-faint">Words / min</div>
      <OptionWheel
        key={items.join(",")}
        items={items}
        defaultSelected={index}
        textColor="rgb(var(--ink-faint))"
        activeColor="rgb(var(--ink))"
        side="left"
        fontSize={1.75}
        spacing={1.6}
        curve={1}
        tilt={8}
        blur={1.5}
        fade={0.28}
        smoothing={160}
        inset={24}
        loop={false}
        draggable
        onChange={(_, item) => dispatch({ type: "SET_WPM", wpm: Number(item) })}
      />
    </div>
  );
}
