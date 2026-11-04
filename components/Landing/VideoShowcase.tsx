"use client";
import { BRAND_NAME } from "@/lib/brand";
import GlassSurface from "@/components/ui/GlassSurface";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/** Put your own video at public/videos/landing-hero.mp4 (see public/videos/README.txt). */
export const VIDEO_SRC = "/videos/landing-hero.mp4";
/** Optional WebM copy (same name, .webm) for browsers without H.264; safe to delete. */
export const VIDEO_WEBM_SRC = "/videos/landing-hero.webm";
export const POSTER_SRC = "/videos/landing-hero-poster.jpg";

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
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
      <h2 id="video-h" className="font-display text-3xl leading-tight text-ink sm:text-5xl">Read faster. Remember more.</h2>
      <p className="mx-auto mt-5 max-w-xl text-lg text-ink-muted">{t.caption}</p>

      <div role="tablist" aria-label="What you can do" className="mx-auto mt-8 inline-flex rounded-full bg-overlay/[0.06] p-1.5">
        {TABS.map((x, i) => (
          <button
            key={x.n}
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors sm:px-6 sm:text-base ${i === tab ? "bg-canvas text-ink shadow-themed" : "text-ink-muted hover:text-ink"}`}
          >
            <span className="font-mono text-xs text-ink-faint">{x.n}</span>
            {x.label}
          </button>
        ))}
      </div>
      </div>

      {/* Wide 16:9 stage, like the Apple product page: nearly the full width of the screen. */}
      <div className="relative mx-auto mt-6 w-full max-w-[1750px] px-[4%] sm:px-[5%]">
        <div className="relative aspect-video overflow-hidden rounded-[28px] bg-[#1d2b27] sm:rounded-[40px]">
          {failed ? (
            <div aria-hidden className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#1d2b27] via-[#3f5646] to-[#4a3b58]" />
          ) : (
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
          )}
          <button
            onClick={toggle}
            aria-label={playing ? "Pause video" : "Play video"}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>

        <div key={tab} className="absolute -bottom-5 right-4 isolate w-[min(78%,22rem)] rounded-[20px] p-5 text-left shadow-themed sm:bottom-10 sm:right-10 sm:rounded-[24px] sm:p-7">
          {/* Same liquid-glass surface as the navbar, as a layer behind the text. */}
          <div className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
            <GlassSurface width="100%" height="100%" borderRadius={24} backgroundOpacity={0.55} blur={11} showEdgeHighlight={false} />
          </div>
          <div className="text-sm text-ink-muted">{t.kicker}</div>
          <p className="mt-3 font-display text-2xl leading-[1.05] tracking-[-0.03em] text-ink sm:text-4xl">
            {t.line[0]}<br />{t.line[1]}
          </p>
        </div>
      </div>
    </section>
  );
}
