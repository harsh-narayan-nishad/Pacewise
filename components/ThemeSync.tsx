"use client";

import { useEffect, useRef } from "react";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import { FontSettings } from "@/types";

type Theme = FontSettings["brightness"];
const CHOICE_KEY = "speed-reader.theme-choice";

function readChoice(): Theme | null {
  try {
    const v = window.localStorage.getItem(CHOICE_KEY);
    return v === "dark" || v === "light" || v === "sepia" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The single place that writes `data-theme` onto <html>. Every themeable
 * color in the app reads from the CSS variables that attribute selects
 * (see globals.css), so this one effect is what makes a theme change
 * propagate to the navbar, cards, buttons, borders, and shadows.
 *
 * Default: follow the system (prefers-color-scheme), live, until the person
 * picks a theme themselves; that choice is then remembered and wins.
 * `fonts.brightness` (dark/light/sepia) doubles as the app-wide theme.
 */
export function ThemeSync() {
  const { fonts } = useReadingState();
  const dispatch = useReadingDispatch();
  // The value we last applied on the system's behalf; anything else arriving is the person's own choice.
  const pending = useRef<Theme | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const system = (): Theme => (mq.matches ? "dark" : "light");
    const apply = (t: Theme) => {
      pending.current = t;
      dispatch({ type: "UPDATE_FONTS", fonts: { brightness: t } });
    };
    apply(readChoice() ?? system());
    ready.current = true;
    const onChange = () => { if (!readChoice()) apply(system()); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.dataset.theme = fonts.brightness;
    if (!ready.current) return;
    if (pending.current !== null) {
      // Still waiting for our own dispatch to land; ignore the stale value before it.
      if (fonts.brightness === pending.current) pending.current = null;
      return;
    }
    try { window.localStorage.setItem(CHOICE_KEY, fonts.brightness); } catch { /* best effort */ }
  }, [fonts.brightness]);

  return null;
}
