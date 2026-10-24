"use client";

import { useEffect } from "react";
import { useReadingState } from "@/contexts/ReadingContext";

/**
 * The single place that writes `data-theme` onto <html>. Every themeable
 * color in the app reads from the CSS variables that attribute selects
 * (see globals.css), so this one effect is what makes a theme change
 * propagate to the navbar, cards, buttons, borders, and shadows — not just
 * the reading background.
 *
 * `fonts.brightness` (dark/light/sepia) doubles as the app-wide theme
 * rather than introducing a second, parallel "theme" field: it already had
 * exactly the three values the UI exposes as theme options, so splitting
 * it into two settings would just be two controls for one decision.
 */
export function ThemeSync() {
  const state = useReadingState();

  useEffect(() => {
    document.documentElement.dataset.theme = state.fonts.brightness;
  }, [state.fonts.brightness]);

  return null;
}
