"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";

/** Dark-mode switch for the navbar: on = dark, off = light (sepia stays available in Settings). */
export function ThemeSwitch() {
  const { fonts } = useReadingState();
  const dispatch = useReadingDispatch();
  const dark = fonts.brightness === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={() => dispatch({ type: "UPDATE_FONTS", fonts: { brightness: dark ? "light" : "dark" } })}
      className={`relative h-7 w-12 shrink-0 rounded-full border border-overlay/15 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-medium ${dark ? "bg-ink/90" : "bg-overlay/10"}`}
    >
      <span className={`absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-canvas text-ink shadow-sm transition-transform duration-200 ${dark ? "translate-x-5" : "translate-x-0"}`}>
        {dark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
      </span>
    </button>
  );
}
