"use client";

import { useEffect, useState } from "react";

export type ThemeName = "dark" | "light" | "sepia";

/**
 * Tracks the app's own theme switch (dark/light/sepia, cycled from TopNav,
 * applied as `data-theme` on `<html>` — see globals.css), not the OS's
 * `prefers-color-scheme`. Any component whose own colors (canvas draw
 * calls, SVG filters, etc.) can't just reference the CSS custom properties
 * in globals.css directly needs to know the theme in JS to pick a
 * matching palette — this is the one shared place that watches it, via a
 * `MutationObserver` (the theme can change at any time from a click, not
 * just on mount).
 *
 * Defaults to "dark" before mount, matching `<html data-theme="dark">` in
 * app/layout.tsx, so there's no flash from a wrong initial guess.
 */
export function useThemeName(): ThemeName {
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const readTheme = (): ThemeName => {
      const attr = document.documentElement.getAttribute("data-theme");
      return attr === "light" || attr === "sepia" ? attr : "dark";
    };
    setTheme(readTheme());

    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
