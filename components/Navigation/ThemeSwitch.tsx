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
      className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-overlay/[0.08] text-ink-muted transition-colors hover:bg-overlay/[0.14] hover:text-ink active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-medium"
    >
      <Sun className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Moon className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}
