"use client";

import { BRAND_NAME } from "@/lib/brand";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sun, Moon, Coffee } from "lucide-react";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/Navigation/ProfileMenu";
import { HamburgerMenu } from "@/components/Navigation/HamburgerMenu";
import { NotificationBell } from "@/components/Navigation/NotificationBell";
import { SearchBar } from "@/components/Search/SearchBar";
import { MobileSearchSheet } from "@/components/Search/MobileSearchSheet";
import GlassSurface from "@/components/ui/GlassSurface";
import { FontSettings } from "@/types";
import { ReadingModeToggle } from "@/components/ReadingMode/ReadingModeToggle";
import { useIdleDim } from "@/components/ReadingMode/useIdleDim";
import { remainingMs } from "@/lib/readingMode/progress";
import { durationForWpm, formatDuration, storyWordCount } from "@/lib/wpmCalculator";

const THEME_ORDER: FontSettings["brightness"][] = ["dark", "light", "sepia"];
const THEME_ICON: Record<FontSettings["brightness"], React.ElementType> = {
  dark: Moon,
  light: Sun,
  sepia: Coffee,
};

/**
 * Global, sticky, glassmorphic navbar — rendered once in the root layout so
 * every route (dashboard/reader/questions/results) shares identical chrome
 * and theming instead of each page rolling its own header. Progress/WPM
 * only render during an active reading session; elsewhere the middle slot
 * collapses so the bar never shows stale numbers.
 */
export function TopNav() {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const ThemeIcon = THEME_ICON[state.fonts.brightness];
  const isReading = state.phase === "reading" || state.phase === "completed";
  // Phase 10 of the social-features brief: the navbar's own search box
  // must be hidden specifically on the landing page (no story loaded —
  // that page has its own, differently-sized search box, see
  // SearchLanding.tsx/SearchBar's `size` prop) and shown on every other
  // app/content page. `isReading` alone used to gate this, which left the
  // navbar's search visible *at the same time* as the landing page's own
  // search box, since `isReading` is false on the landing page too —
  // fixed by also requiring a story to be loaded.
  const showNavbarSearch = Boolean(state.story) && !isReading;
  const actualWpm = state.actualWpmSamples.length
    ? state.actualWpmSamples[state.actualWpmSamples.length - 1]
    : state.selectedWpm;

  // Reading mode (free-scroll article at /read): same navbar timer, no practice widgets.
  const inReadingMode = pathname === "/read" && Boolean(state.story);
  // The mode is chosen BEFORE practice: offered on the story page and inside reading mode,
  // never once an auto-scroll session has started.
  const canChooseReadingMode =
    Boolean(state.story) && (inReadingMode || (pathname === "/" && state.phase === "dashboard"));
  const showTimer = isReading || inReadingMode;
  // Time left at the selected speed — as large as the landing heading, and dimmed after a few idle seconds.
  const dimTimer = useIdleDim(2500, showTimer);
  // Practice: scroll-driven. Reading mode: a real clock counting down from words/wpm (scrolling doesn't move it).
  const timeLeft = state.story
    ? formatDuration(
        inReadingMode
          ? remainingMs(storyWordCount(state.story), state.selectedWpm, state.readingElapsedMs)
          : Math.max(0, durationForWpm(storyWordCount(state.story), state.selectedWpm) * (1 - state.progress))
      )
    : "0:00";

  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(state.fonts.brightness);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    dispatch({ type: "UPDATE_FONTS", fonts: { brightness: next } });
  }

  // The logo's click target: returns to the search landing page by
  // clearing the loaded story (see CLEAR_STORY in ReadingContext.tsx).
  // Inert during an active reading session so a stray click can't discard
  // in-progress reading state — the logo simply does nothing mid-read,
  // same as it always has.
  function goHome() {
    if (isReading) return;
    dispatch({ type: "CLEAR_STORY" });
    router.push("/");
  }

  return (
    // overflow-visible is explicit (not just the default) on both the bar
    // and its inner row, since dropdown-style menus (ProfileMenu) are
    // positioned absolute and must never be clipped by the bar's fixed
    // h-14 height. GlassSurface's own root div is `overflow-hidden` (part
    // of its supplied styling), so it can't wrap the nav content directly
    // without clipping those dropdowns — instead it's rendered as a
    // full-bleed layer behind the content (`absolute inset-0 -z-10`,
    // sized to the header via `width="100%" height="100%"`), with the
    // actual nav row stacked on top as an ordinary sibling. Rendered on
    // every route from the root layout (see app/layout.tsx), so the same
    // glass bar is consistent across the whole app, not just this page.
    //
    // `showEdgeHighlight={false}`: GlassSurface's default look rings the
    // whole surface in a bright line on all four sides, which is right
    // for a floating panel but wrong for a bar anchored to the screen's
    // top edge — the left/top/right segments of that ring don't border
    // anything real. The header's own `border-b` below is the only line
    // that should show, on the bottom edge where the bar actually meets
    // the page content.
    <header className="sticky top-0 z-[100] overflow-visible border-b border-overlay/10 shadow-themed">
      <div className="absolute inset-0 -z-10">
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={0}
          backgroundOpacity={0.55}
          blur={11}
          showEdgeHighlight={false}
        />
      </div>
      {inReadingMode && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-overlay/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress * 100)} aria-label="Reading progress">
          <div className="h-full bg-accent-medium transition-[width] duration-300 ease-out" style={{ width: `${state.progress * 100}%` }} />
        </div>
      )}
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 overflow-visible px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <HamburgerMenu />
          <button
            type="button"
            onClick={goHome}
            aria-label={`${BRAND_NAME} — back to search`}
            className="flex shrink-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
          >
            <span className="hidden text-sm font-semibold tracking-tight text-ink sm:inline">
              {BRAND_NAME}
            </span>
          </button>
          {state.story && (
            <>
              <span className="hidden h-4 w-px bg-overlay/15 sm:block" />
              <span className="truncate text-sm text-ink-muted">{state.story.title}</span>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-4">
          {showTimer ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 sm:gap-4"
            >
              <span
                className={`font-display text-3xl leading-none tracking-[-0.03em] text-ink tabular-nums transition-opacity duration-700 sm:text-5xl ${dimTimer ? "opacity-25" : "opacity-100"}`}
                aria-label={`Time left ${timeLeft}`}
                title="Time left"
              >
                {timeLeft}
              </span>
              {inReadingMode ? (
                <div className={`flex shrink-0 items-center gap-1 font-mono text-xs text-ink-muted transition-opacity duration-700 ${dimTimer ? "opacity-40" : "opacity-100"}`} role="group" aria-label="Reading speed">
                  <button type="button" aria-label="Slower" onClick={() => dispatch({ type: "SET_WPM", wpm: state.selectedWpm - 25 })} className="h-7 w-7 rounded-full border border-overlay/15 hover:border-overlay/30 hover:text-ink sm:h-6 sm:w-6">−</button>
                  <span className="min-w-[3ch] text-center sm:min-w-[4.5ch]">{state.selectedWpm}<span className="hidden sm:inline"> wpm</span></span>
                  <button type="button" aria-label="Faster" onClick={() => dispatch({ type: "SET_WPM", wpm: state.selectedWpm + 25 })} className="h-7 w-7 rounded-full border border-overlay/15 hover:border-overlay/30 hover:text-ink sm:h-6 sm:w-6">+</button>
                </div>
              ) : (
                <span className={`shrink-0 font-mono text-xs text-ink-muted transition-opacity duration-700 ${dimTimer ? "opacity-40" : "opacity-100"}`}>{Math.round(actualWpm)} wpm</span>
              )}
            </motion.div>
          ) : showNavbarSearch ? (
            <div className="hidden sm:block">
              <SearchBar size="sm" />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {showNavbarSearch && <MobileSearchSheet />}
          {canChooseReadingMode && (
            <div className="mr-1 sm:mr-2">
              <ReadingModeToggle
                checked={state.readingMode}
                onChange={(on) => {
                  dispatch({ type: "SET_READING_MODE", on });
                  if (!on && inReadingMode) router.push("/");
                }}
              />
            </div>
          )}
          <div className={showTimer ? "hidden sm:block" : undefined}><NotificationBell /></div>
          <Button size="icon" variant="ghost" onClick={cycleTheme} aria-label={`Theme: ${state.fonts.brightness}`}>
            <ThemeIcon className="h-4 w-4" />
          </Button>
          {/* The fullscreen toggle and the reading-customization ("Reading
              settings") buttons that used to live here were removed per
              request — fullscreen stays reachable via its existing
              keyboard shortcut (see app/reader/page.tsx's useKeyboard
              wiring), and the customization panel stays reachable via its
              own gear button in the bottom Controls dock
              (components/Controls/Controls.tsx), so neither feature was
              actually dropped, just this duplicate top-bar entry point. */}
          <span className="mx-1 hidden h-5 w-px bg-overlay/15 sm:block" />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
