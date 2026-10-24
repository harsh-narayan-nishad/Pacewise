"use client";

import React, { useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { StoryData, FontSettings } from "@/types";
import { cn } from "@/lib/utils";
import GlassSurface from "@/components/ui/GlassSurface";

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.1;

interface MediaReaderProps {
  story: StoryData;
  fonts: FontSettings;
  trackRef: React.RefObject<HTMLDivElement>;
  /** The real, scrollable viewport the engine drives (see
   *  useReadingEngine) — identical contract to Reader.tsx's own prop. */
  viewportRef: React.RefObject<HTMLDivElement>;
  reserveSpeedometerColumn?: boolean;
}

/**
 * The PDF/image counterpart to `Reader.tsx` — renders an uploaded story's
 * pages (see `lib/mediaStory.ts`) as a stacked, auto-scrolling track
 * instead of paragraphs. It shares `Reader.tsx`'s exact scroll contract
 * (the same `trackRef`/`viewportRef`, driven by the same, completely
 * unmodified `useReadingEngine` — see app/reader/page.tsx, which picks
 * between this component and `Reader` based on `story.media`), so every
 * existing control already applies to a PDF/image with zero changes to
 * any of them: Play/Pause/Restart/Skip, WPM speed, the Speedometer, break
 * tracking, the progress bar, keyboard shortcuts, and fullscreen none of
 * them know or care whether the track holds text paragraphs or page
 * images — they only ever talk to `trackRef`/`viewportRef`/`progress`.
 *
 * `fonts.contentWidth` — the same slider that clamps the text column's
 * line length on the normal Reader — doubles here as the page-image width
 * control, so "Controls" still has a real, visible effect on an uploaded
 * PDF/image, per the brief's "all controls should be also applied to
 * that pdf/img" ask. It's converted from `ch` units to a comparable pixel
 * width (image width has no natural "characters" meaning) rather than
 * reused as-is. Font family/size/line-height/letter-spacing have no
 * meaning for a page image and are simply not applied here — there's no
 * text to render them against.
 */
export function MediaReader({ story, fonts, trackRef, viewportRef, reserveSpeedometerColumn = false }: MediaReaderProps) {
  const media = story.media;
  // Independent of fonts.contentWidth — that slider sets the *base*
  // column width (same control as the text Reader); zoom is a multiplier
  // on top of it, specific to page images, since "how wide the column is"
  // and "how large the page looks" are two different things once you're
  // looking at a scanned/rendered page rather than reflowable text.
  const [zoom, setZoom] = useState(1);

  if (!media) return null;

  // contentWidth is a viewport-relative (vw) unit — same slider, same
  // value, as Reader.tsx's text column — so the two screens stay
  // consistent; clamped to the same 90-unit safety cap. zoom multiplies on
  // top of that via calc(), independent of the base column width.
  const effectiveContentWidth = Math.min(fonts.contentWidth, 90);
  const pageMaxWidth = `calc(min(${effectiveContentWidth}vw, 100%) * ${zoom})`;

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  const zoomReset = () => setZoom(1);

  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas text-ink transition-colors">
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
          className="flex w-full flex-col items-center pt-[70vh] pb-[70vh]"
          style={{ maxWidth: pageMaxWidth }}
        >
          {media.pages.map((page, i) => (
            // Plain <img> rather than next/image: these are in-memory
            // data URLs (see lib/mediaStory.ts) with no server to
            // optimize them through, and next/image's layout machinery
            // isn't needed here — width/height just seed the intrinsic
            // aspect ratio so nothing jumps as each page paints in.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={page.src}
              alt={`${story.title} — page ${i + 1} of ${media.pages.length}`}
              width={page.width}
              height={page.height}
              draggable={false}
              className="mb-10 h-auto w-full select-none rounded-lg shadow-themed last:mb-0"
            />
          ))}
        </div>
      </div>

      {/* Zoom controls — PDF/image pages only (plain-text stories reflow
          via fonts.contentWidth instead, which has no "zoom" concept).
          Scales the already-high-resolution page raster (rendered at
          3.5x in lib/mediaStory.ts) via plain width, so zooming in stays
          crisp instead of upscaling a low-res image into visible
          pixelation. Bottom-left, raised well clear of the bottom
          Controls dock (and its expandable settings panel, which can
          span nearly the full width when open) on every breakpoint —
          `bottom-24` leaves a safe gap above the dock instead of the
          previous `bottom-6`, which sat low enough to be covered by the
          dock on narrow/mobile screens; z-30 (above the dock's z-20) is
          extra insurance against any residual overlap. */}
      <div className="fixed bottom-24 left-4 z-30 flex items-center gap-1 overflow-hidden rounded-full border border-overlay/10 px-1.5 py-1.5 shadow-themed">
        <div className="absolute inset-0 -z-10">
          <GlassSurface width="100%" height="100%" borderRadius={999} backgroundOpacity={0.55} blur={11} />
        </div>
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-opacity hover:bg-overlay/10 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={zoomReset}
          aria-label="Reset zoom"
          className="min-w-[3.25rem] rounded-full px-1.5 py-1 text-center text-xs tabular-nums text-ink-muted transition-colors hover:text-ink"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-opacity hover:bg-overlay/10 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
        {zoom !== 1 && (
          <button
            type="button"
            onClick={zoomReset}
            aria-label="Reset zoom to 100%"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
