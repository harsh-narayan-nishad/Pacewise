"use client";

import React, { useLayoutEffect, useRef } from "react";
import { SearchBar } from "@/components/Search/SearchBar";
import { useInertiaScroll } from "@/components/ReadingMode/useInertiaScroll";
import { PlatformShowcase, PlatformVideo } from "@/components/Landing/PlatformShowcase";
import { ContentFeed } from "@/components/Search/ContentFeed";
import DotField from "@/components/DotField";
import { useThemeName } from "@/lib/useThemeName";
import { LandingBackground } from "@/components/Landing/LandingBackground";
import { themeFilter, useLandingTheme } from "@/lib/landingTheme";
import { BRAND_HEADLINE } from "@/lib/brand";
import { useReadingState } from "@/contexts/ReadingContext";

/** Per-theme colours for the dot-grid background (a canvas can't read CSS variables). */
const DOT_FIELD_PALETTES: Record<
  "dark" | "light" | "sepia",
  { gradientFrom: string; gradientTo: string; glowColor: string; dotRadius: number }
> = {
  dark: { gradientFrom: "#ffffff", gradientTo: "#B497CF", glowColor: "#120F17", dotRadius: 0.5 },
  light: { gradientFrom: "#1A1625", gradientTo: "#7C3AED", glowColor: "#B497CF", dotRadius: 1.2 },
  sepia: { gradientFrom: "#1F1708", gradientTo: "#8B5E34", glowColor: "#4A3920", dotRadius: 1.2 },
};


/** Witty's hero heading grey ("Built for brains, wired for wins."). */
const WITTY_MUTED = "#6E6E73";

/**
 * The headline, still (no motion): only the first letter in the normal ink colour, the rest of the lead-in in
 * Witty's grey; the closing phrase keeps Pacewise's gradient (accent-slow to accent-medium), as one continuous
 * gradient across its words. Falls back to the same colours without the gradient if the wording ever changes.
 */
function Headline({ text, accent }: { text: string; accent: string }) {
  const at = text.indexOf(accent);
  const lead = at < 0 ? text : text.slice(0, at);
  return (
    <>
      {lead.slice(0, 1)}
      <span style={{ color: WITTY_MUTED }}>{lead.slice(1)}</span>
      {at >= 0 && (
        <>
          <span className="bg-gradient-to-r from-accent-slow to-accent-medium bg-clip-text text-transparent">{accent}</span>
          <span style={{ color: WITTY_MUTED }}>{text.slice(at + accent.length)}</span>
        </>
      )}
    </>
  );
}

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
  // The landing page is light-only, in Mediconnect's colours (see globals.css, :root[data-landing]). The person's own
  // theme choice is untouched and comes back as soon as they leave this page.
  const { fonts } = useReadingState();
  const chosenTheme = useRef(fonts.brightness);
  chosenTheme.current = fonts.brightness;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.landing = "1";
    root.dataset.theme = "light";
    return () => {
      delete root.dataset.landing;
      root.dataset.theme = chosenTheme.current;
    };
  }, []);
  const theme = useThemeName();
  const dotFieldPalette = DOT_FIELD_PALETTES[theme];
  const [bg] = useLandingTheme();

  return (
    <div className="relative w-full">
      {/* Hero laid out like the Mediconnect patient app's hero (flex-col items-center, mt-6 lg:mt-20): it starts near the top
          instead of filling the screen with the content centred, and leaves only a small gap before "The latest." */}
      <div className="relative flex w-full flex-col items-center overflow-hidden px-6 pb-20 pt-6 lg:pb-[88px] lg:pt-20">
        {/* Twinkling dot-grid background (hero only, behind everything). It no longer reacts to
            the mouse: cursorRadius 0 switches the cursor bulge off; the sparkle stays. */}
        <div className="pointer-events-none absolute inset-0 z-0" style={{ filter: themeFilter(bg) }}>
          {bg.mode !== "dots" ? <LandingBackground theme={bg} /> : (
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
          )}
          {bg.dim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bg.dim }} />}
        </div>

        {/* Guide lines: two vertical rails at the content edges, on the hero only (not the sections below it),
            above the dot background and behind the content (decorative, never clickable). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
          <div className="mx-auto h-full max-w-5xl border-x border-overlay/10" />
        </div>

        {/* Hero frame, fitted to the content: a line just above the headline and one just below the search, with equal
            space to each, across the full width; a small square where each meets a vertical rail (the rails sit at
            the max-w-5xl edges, i.e. centre ± min(512px, 50vw)). */}
        <div className="relative z-10 flex w-full flex-col items-center py-14 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
          <div className="absolute left-1/2 top-0 h-px w-screen -translate-x-1/2 bg-overlay/10" />
          <div className="absolute bottom-0 left-1/2 h-px w-screen -translate-x-1/2 bg-overlay/10" />
          {[
            { left: "calc(50% - min(512px, 50vw) + 0.5px)", y: "top-[0.5px] -translate-y-1/2" },
            { left: "calc(50% + min(512px, 50vw) - 0.5px)", y: "top-[0.5px] -translate-y-1/2" },
            { left: "calc(50% - min(512px, 50vw) + 0.5px)", y: "bottom-[0.5px] translate-y-1/2" },
            { left: "calc(50% + min(512px, 50vw) - 0.5px)", y: "bottom-[0.5px] translate-y-1/2" },
          ].map(({ left, y }) => (
            // 6px square centred exactly on the crossing of a vertical rail and a horizontal line.
            <span key={left + y} style={{ left }} className={`absolute ${y} hidden h-1.5 w-1.5 -translate-x-1/2 bg-ink sm:block`} />
          ))}
        </div>

        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
          {/* Weight 400 and 72px on large screens, as the Mediconnect hero ("Mediconnect build for Careseekers": Poppins Regular, lg:text-7xl = 72px);
              Pacewise's own display font, tracking and tight display line-height stay. */}
          <h1 className="mb-10 font-display !font-normal text-4xl text-ink sm:text-6xl lg:text-[72px] lg:leading-[1.05]">
            <Headline text={BRAND_HEADLINE} accent="speed of thought." />
          </h1>
          <SearchBar />
        </div>
        </div>
      </div>

      {/* "Read faster. Remember more." comes before "The latest. Fresh reads picked for you." */}
      <PlatformVideo />
      <ContentFeed />
      <PlatformShowcase />
    </div>
  );
}
