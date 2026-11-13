"use client";

import React from "react";
import { StoryData, FontSettings } from "@/types";
import { cn } from "@/lib/utils";
import { useStoryHtml } from "@/components/Reader/useStoryHtml";

interface ReaderProps {
  story: StoryData;
  fonts: FontSettings;
  trackRef: React.RefObject<HTMLDivElement>;
  /** The real, scrollable viewport the engine drives (see
   *  useReadingEngine). */
  viewportRef: React.RefObject<HTMLDivElement>;
  /** When true, the reading viewport is clamped to the left 85vw of the
   *  screen at the `lg` breakpoint, leaving a dedicated 15vw column free
   *  on the right for the docked Speedometer (see app/reader/page.tsx) —
   *  a real layout split (two widths that sum to 100vw) rather than a
   *  manually-tuned pixel gutter, so the two regions can never overlap
   *  regardless of viewport width. Below `lg` the Speedometer isn't
   *  docked at all, so the viewport simply takes the full width. */
  reserveSpeedometerColumn?: boolean;
}

const familyClass: Record<FontSettings["family"], string> = {
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

/**
 * Renders the story as one continuous track inside a real scrollable
 * viewport (`viewportRef`) that a parent hook drives by setting
 * `scrollTop` every animation frame (see `useReadingEngine`). The
 * component itself stays "dumb" — it has no timers of its own — which
 * keeps it cheap to re-render and easy to reason about in isolation.
 *
 * Note: an earlier version of this screen also drove a scroll-position
 * "mute" effect here (already-read text turning fully clear, text ahead
 * staying dimmed/blurred). That effect has been removed per feedback —
 * paragraphs render at full, constant opacity throughout a session now,
 * same as before that effect was ever added. `useReadingEngine` no longer
 * touches paragraph styles at all, only `scrollTop`.
 *
 * Layout: the track's max-width is `min(contentWidth ch, 100%)`, where
 * "100%" is simply whatever width the viewport itself has — full width
 * below `lg`, or the left 85vw of the screen at `lg` when
 * `reserveSpeedometerColumn` is set (see the prop doc above). Widening
 * the "content width" slider can never push text under the Speedometer's
 * column: it gets clamped against the viewport's own box, not against an
 * independently-computed pixel gutter. Colors come entirely from the
 * `canvas`/`ink` theme tokens (see globals.css) so the reading surface
 * repaints correctly for dark/light/sepia without a component-local color
 * map.
 *
 * Typography: generous paragraph spacing, antialiased glyph rendering,
 * and `text-wrap: pretty` (better line-break choices, avoiding orphaned
 * short last lines) are the only stylistic additions here — a calmer,
 * more spacious reading page without touching layout logic elsewhere.
 */
export function Reader({ story, fonts, trackRef, viewportRef, reserveSpeedometerColumn = false }: ReaderProps) {
  // contentWidth is a vw (viewport-width) unit, not `ch` — it scales with
  // screen size the same way the rest of the reading layout does, rather
  // than a fixed character count that reads differently on every monitor.
  const effectiveContentWidth = Math.min(fonts.contentWidth, 90);

  // Rich-editor stories keep their formatting/images/tables/code; see useStoryHtml.
  const richHtml = useStoryHtml(story);

  return (
    <div className="pw-liquid fixed inset-0 overflow-hidden bg-canvas text-ink transition-colors">
      {fonts.guideLine && (
        <div className="pointer-events-none fixed left-0 right-0 top-1/2 z-10 h-px -translate-y-1/2 bg-accent-medium/40" />
      )}
      {fonts.focusMode && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-0 z-10 h-[35vh] bg-gradient-to-b from-[rgb(var(--shadow-color))]/80 to-transparent" />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[35vh] bg-gradient-to-t from-[rgb(var(--shadow-color))]/80 to-transparent" />
        </>
      )}

      <div
        ref={viewportRef}
        className={cn(
          "no-scrollbar flex h-full w-full items-start justify-center overflow-hidden px-6 sm:px-10 lg:px-14",
          reserveSpeedometerColumn && "lg:w-[85vw]"
        )}
      >
        <div
          ref={trackRef}
          className={cn("w-full pt-[70vh] pb-[70vh] antialiased [text-wrap:pretty]", familyClass[fonts.family])}
          style={{
            maxWidth: `min(${effectiveContentWidth}vw, 100%)`,
            fontSize: `${fonts.size}px`,
            lineHeight: fonts.lineHeight,
            letterSpacing: `${fonts.letterSpacing}px`,
          }}
        >
          {richHtml !== null ? (
            <div className="sr-rich" dangerouslySetInnerHTML={{ __html: richHtml }} />
          ) : (
            story.story.map((p, i) => (
              <p key={i} className="mb-10 first:mt-0">
                {p.paragraph}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
