"use client";
import { BRAND_NAME } from "@/lib/brand";
import LiquidGlass from "@/components/FlipReader/ui/LiquidGlass";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";

/*
 * Reveal, as on the Witty Production landing page (Featured + RevealCover): a cover in the page's background colour,
 * anchored left, shrinks toward the left so the video is revealed from right to left, while the video zooms out from
 * 1.6x to 1x. Same timing and easing as Witty (1.4s, ease [0.6, 0.05, -0.01, 0.9], zoom delayed 0.2s).
 * It plays once only: by itself, 0.5s after the page loads (it does not wait for scrolling). Hover and scrolling
 * never replay it.
 */
const REVEAL_EASE = [0.6, 0.05, -0.01, 0.9] as const;
const REVEAL_DELAY_MS = 500;

/** Put your own video at public/videos/landing-hero.mp4 (see public/videos/README.txt). */
export const VIDEO_SRC = "/videos/landing-hero.mp4";
/** Optional WebM copy (same name, .webm) for browsers without H.264; safe to delete. */
export const VIDEO_WEBM_SRC = "/videos/landing-hero.mp4";
export const POSTER_SRC = "/videos/landing-hero.mp4";

const TABS = [
  { n: "01", label: "Read", kicker: "A working habit", line: ["Less noise.", "More words per minute."], caption: "Pick a story, set your pace, and let the page move for you or scroll it yourself." },
  { n: "02", label: "Revise", kicker: "Your own material", line: ["Write it once.", "Revise it forever."], caption: "Turn your notes into stories with questions, then re-read and re-test until they stick." },
  { n: "03", label: "Share", kicker: "Better together", line: ["Follow readers.", "Compare, discuss, improve."], caption: "Share stories, comment, save playlists and follow people preparing for the same goal." },
] as const;

/**
 * Landing-page showcase: three pill tabs, a large rounded panel with an
 * autoplaying (muted, looping) video, and a floating card whose text changes
 * with the tab. Falls back to an animated gradient if the video can't load.
 */
export function VideoShowcase() {
  const [tab, setTab] = useState(0);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const t = TABS[tab];
  const reduceMotion = useReducedMotion(); // "Reduce motion": no reveal, the video is simply there
  const cover = useAnimationControls();
  const zoom = useAnimationControls();
  const revealed = useRef(false);

  function reveal() {
    if (reduceMotion || revealed.current) return; // once only
    revealed.current = true;
    void cover.start({ width: "0%", transition: { duration: 1.4, ease: REVEAL_EASE } });
    void zoom.start({ scale: 1, transition: { duration: 1.4, ease: REVEAL_EASE, delay: 0.2 } });
  }

  // Automatic, once: 0.5s after the page loads.
  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = window.setTimeout(reveal, REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // Autoplay is allowed because the video is muted; if the browser still refuses, show the play control.
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  function toggle() {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().then(() => setPlaying(true)).catch(() => undefined);
    else { v.pause(); setPlaying(false); }
  }

  return (
    <section aria-labelledby="video-h" className="text-center">
      {/* Tabs just above the video. */}
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
      <div role="tablist" aria-label="What you can do" className="mx-auto inline-flex rounded-full bg-overlay/[0.06] p-1.5">
        {TABS.map((x, i) => (
          <button
            key={x.n}
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors sm:px-6 sm:text-base ${i === tab ? "bg-[#005bd4] text-white shadow-themed" : "text-ink-muted hover:text-ink"}`}
          >
            {/* Selected tab in Witty's button blue (#005bd4, white text). */}
            <span className={`font-mono text-xs ${i === tab ? "text-white/70" : "text-ink-faint"}`}>{x.n}</span>
            {x.label}
          </button>
        ))}
      </div>
      </div>

      {/* Wide 16:9 stage, like the Apple product page: nearly the full width of the screen. */}
      <div className="relative mx-auto mt-6 w-full max-w-[1750px] px-[4%] sm:px-[5%]">
        {/* Same size as the video. The glass card sits beside the clipped video box (not inside its rounded overflow clip,
            which would stop the liquid backdrop effect), positioned so it stays within the video's edges. */}
        <div className="relative">
        <div className="relative aspect-video overflow-hidden rounded-[0.5rem] bg-[#1d2b27] min-[769px]:rounded-[0.75rem]">
          {failed ? (
            <div aria-hidden className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#1d2b27] via-[#3f5646] to-[#4a3b58]" />
          ) : (
            <motion.div
              className="absolute inset-0"
              initial={reduceMotion ? false : { scale: 1.6 }}
              animate={zoom}
            >
            <video
              ref={video}
              className="absolute inset-0 h-full w-full object-cover"
              poster={POSTER_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label={`${BRAND_NAME} in action`}
            >
              <source src={VIDEO_WEBM_SRC} type="video/webm" />
              <source src={VIDEO_SRC} type="video/mp4" onError={() => setFailed(true)} />
            </video>
            </motion.div>
          )}
          <button
            onClick={toggle}
            aria-label={playing ? "Pause video" : "Play video"}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
          {/* Glass card: anchored to the video's bottom-right corner, within its edges. */}
          <div key={tab} className="absolute bottom-3 right-3 isolate w-[min(78%,22rem)] rounded-[20px] p-5 text-left shadow-themed sm:bottom-10 sm:right-10 sm:rounded-[24px] sm:p-7">
            {/* The reader's liquid glass (lens rim, specular light, inner glow), almost clear: a 6% white tint instead of
                the reader's 40%, so the video shows through. The reader's dark-mode glass values are passed in directly
                because they are otherwise scoped to the reader. Text is light so it reads on the clear glass over the video. */}
            <div
              className="absolute inset-0 -z-10 rounded-[inherit]"
              style={{
                "--glass-tint": "rgba(255, 255, 255, 0.06)",
                "--glass-shadow": "0 12px 36px rgba(0, 0, 0, 0.42), 0 2px 8px rgba(0, 0, 0, 0.3)",
                "--glass-edge": "rgba(255, 255, 255, 0.22)",
                "--glass-text-shadow": "none",
                "--glow-a": "0.07",
                "--rim-a": "0.8",
                "--fg": "#edeef0",
              } as React.CSSProperties}
            >
              <LiquidGlass width="100%" height="100%" radius={24} blur={4} />
            </div>
            <div className="text-sm text-accent-fast">{t.kicker}</div>
            <p className="mt-3 font-display text-2xl leading-[1.05] tracking-[-0.03em] text-[#edeef0] sm:text-4xl">
              {t.line[0]}<br />{t.line[1]}
            </p>
          </div>
          {/* Reveal cover in the page colour, anchored left so it shrinks toward the left: reveal right to left (Witty's RevealCover). */}
          {!reduceMotion && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-20 bg-canvas"
              initial={{ width: "100%" }}
              animate={cover}
            />
          )}
        </div>
      </div>

      {/* Heading and caption below the video. */}
      <div className="mx-auto mt-10 max-w-6xl px-6 sm:mt-12 sm:px-8">
        <h2 id="video-h" className="font-display text-3xl leading-tight text-ink sm:text-5xl">Read faster. Remember more.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-muted">{t.caption}</p>
      </div>
    </section>
  );
}
