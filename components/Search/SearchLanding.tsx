"use client";

import React from "react";
import { motion } from "framer-motion";
import { SearchBar } from "@/components/Search/SearchBar";
import { useInertiaScroll } from "@/components/ReadingMode/useInertiaScroll";
import { PlatformShowcase } from "@/components/Landing/PlatformShowcase";
import { ContentFeed } from "@/components/Search/ContentFeed";
import DotField from "@/components/DotField";
import { useThemeName } from "@/lib/useThemeName";
import { BRAND_HEADLINE, BRAND_TAGLINE } from "@/lib/brand";

/** Per-theme colours for the dot-grid background (a canvas can't read CSS variables). */
const DOT_FIELD_PALETTES: Record<
  "dark" | "light" | "sepia",
  { gradientFrom: string; gradientTo: string; glowColor: string; dotRadius: number }
> = {
  dark: { gradientFrom: "#ffffff", gradientTo: "#B497CF", glowColor: "#120F17", dotRadius: 0.5 },
  light: { gradientFrom: "#1A1625", gradientTo: "#7C3AED", glowColor: "#B497CF", dotRadius: 1.2 },
  sepia: { gradientFrom: "#1F1708", gradientTo: "#8B5E34", glowColor: "#4A3920", dotRadius: 1.2 },
};

/**
 * The app's entry point before any story is loaded — a dedicated,
 * Google-homepage-style landing: a mark, a short line, and the search box
 * centered in the space under the sticky navbar (`min-h-[calc(100vh-56px)]`,
 * 56px being TopNav's h-14), with a feed of browsable stories revealed by
 * scrolling below it (ContentFeed) — the same "search bar first, content
 * surfaces as you scroll" shape as a Google results-adjacent homepage. Per
 * the brief, this is deliberately *not* folded into the Dashboard
 * component — it only ever renders when `state.story` is null (see
 * app/page.tsx), handing off to the real Dashboard the moment a story is
 * chosen, the same way Google's homepage hands off to a results page.
 *
 * The search box's own block (logo, heading, tagline, SearchBar) is
 * untouched from before ContentFeed existed — same size, same copy, same
 * centering — ContentFeed is purely additional content appended after it,
 * per the brief's "don't change the existing design" constraint.
 *
 * Note: earlier rounds of this build tried a scroll-reveal text effect —
 * first here on the landing page, then relocated to the reading-practice
 * screen in a few different forms. Per feedback, that effect has since
 * been removed entirely; this page's own history with it is kept here
 * only as a note that no such effect should be re-added without it being
 * explicitly asked for again.
 */
export function SearchLanding() {
  // Same inertial wheel/keyboard scrolling as reading mode, on the home page too.
  useInertiaScroll(true);
  const theme = useThemeName();
  const dotFieldPalette = DOT_FIELD_PALETTES[theme];

  return (
    <div className="relative w-full">
      {/* Page-wide guide lines: two vertical rails at the content edges that run the
          whole landing page, behind everything (decorative, never clickable). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="mx-auto h-full max-w-6xl border-x border-overlay/10" />
      </div>

      <div className="relative flex min-h-[calc(100vh-56px)] w-full flex-col items-center justify-center overflow-hidden px-6 py-24">
        {/* Twinkling dot-grid background (hero only, behind everything). It no longer reacts to
            the mouse: cursorRadius 0 switches the cursor bulge off; the sparkle stays. */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <DotField
            dotRadius={dotFieldPalette.dotRadius}
            dotSpacing={16}
            bulgeStrength={70}
            glowRadius={0}
            sparkle
            waveAmplitude={0}
            cursorRadius={0}
            cursorForce={0}
            bulgeOnly
            gradientFrom={dotFieldPalette.gradientFrom}
            gradientTo={dotFieldPalette.gradientTo}
            glowColor={dotFieldPalette.glowColor}
          />
        </div>

        {/* Hero frame: two horizontal lines across the full width, with a small
            square where each meets a vertical rail. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
          <div className="absolute inset-x-0 top-[14%] h-px bg-overlay/10" />
          <div className="absolute inset-x-0 bottom-[14%] h-px bg-overlay/10" />
          <div className="relative mx-auto h-full max-w-6xl">
            {[
              ["left-[0.5px] -translate-x-1/2", "top-[calc(14%+0.5px)] -translate-y-1/2"],
              ["right-[0.5px] translate-x-1/2", "top-[calc(14%+0.5px)] -translate-y-1/2"],
              ["left-[0.5px] -translate-x-1/2", "bottom-[calc(14%+0.5px)] translate-y-1/2"],
              ["right-[0.5px] translate-x-1/2", "bottom-[calc(14%+0.5px)] translate-y-1/2"],
            ].map(([x, y]) => (
              // 6px square centred exactly on the crossing of a vertical rail and a horizontal line.
              <span key={`${x}${y}`} className={`absolute ${x} ${y} hidden h-1.5 w-1.5 bg-ink sm:block`} />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center"
        >
          <h1 className="mb-4 font-display text-4xl text-ink sm:text-6xl">{BRAND_HEADLINE}</h1>
          <p className="mb-10 text-sm text-ink-muted sm:text-base">{BRAND_TAGLINE}</p>
          <SearchBar />
        </motion.div>
      </div>

      <ContentFeed />
      <PlatformShowcase />
    </div>
  );
}
