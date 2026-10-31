"use client";

import React, { useMemo } from "react";
import OptionWheel from "@/components/ui/OptionWheel";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import { WPM_PRESETS } from "@/lib/wpmCalculator";

/**
 * Speed picker: scroll/drag the wheel to choose any reading speed. It sits on the story's landing hero
 * (`inline`, light-on-dark), so the speed is decided before reading starts and cannot be changed while
 * reading. The navbar shows how long the whole story takes at that speed.
 */
export function SpeedWheel({ inline = false }: { inline?: boolean }) {
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
    <div className={inline ? "relative mb-5 h-40 w-48 sm:h-44" : "fixed left-0 top-1/2 z-30 hidden h-80 w-44 -translate-y-1/2 lg:block"} role="group" aria-label="Reading speed">
      <div className={`absolute top-0 text-[11px] font-medium uppercase tracking-widest ${inline ? "left-1 text-white/60" : "left-6 text-ink-faint"}`}>Words / min</div>
      <OptionWheel
        key={items.join(",")}
        items={items}
        defaultSelected={index}
        textColor={inline ? "rgba(255,255,255,0.5)" : "rgb(var(--ink-faint))"}
        activeColor={inline ? "#ffffff" : "rgb(var(--ink))"}
        side="left"
        fontSize={1.75}
        spacing={1.6}
        curve={1}
        tilt={8}
        blur={1.5}
        fade={0.28}
        smoothing={160}
        inset={inline ? 4 : 24}
        loop={false}
        draggable
        onChange={(_, item) => dispatch({ type: "SET_WPM", wpm: Number(item) })}
      />
    </div>
  );
}
