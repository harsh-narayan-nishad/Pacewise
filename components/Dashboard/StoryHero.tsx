"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND_BLUE } from "@/lib/brand";
import { safeThumbnail } from "@/lib/thumbnail";
import { isVideoRef, loadThumbnailVideoUrl } from "@/lib/thumbnailVideo";
import type { StoryData } from "@/types";

interface Props {
  story: StoryData;
  words: number;
  minutes: number;
  wpm: number;
  eyebrow: string;
  onStart: () => void;
  onReadBelow: () => void;
}

/** Full-screen story intro: the uploaded video (poster = thumbnail) behind a big title and a "start" pill. */
export function StoryHero({ story, words, minutes, wpm, eyebrow, onStart, onReadBelow }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const poster = safeThumbnail(story.thumbnail);

  useEffect(() => {
    let live = true;
    setSrc(null);
    if (isVideoRef(story.thumbnailVideo)) void loadThumbnailVideoUrl(story.thumbnailVideo).then((u) => { if (live) setSrc(u); });
    return () => { live = false; };
  }, [story.thumbnailVideo]);

  function toggle() {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().then(() => setPlaying(true)).catch(() => undefined);
    else { v.pause(); setPlaying(false); }
  }

  return (
    <section aria-label={story.title} className="relative -mx-0 h-[calc(100vh-56px)] min-h-[520px] w-full overflow-hidden bg-black text-white">
      {src ? (
        <video ref={video} src={src} poster={poster ?? undefined} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline />
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#1d2b27] via-[#3f5646] to-[#4a3b58]" />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

      {src && (
        <button
          onClick={toggle}
          aria-label={playing ? "Pause video" : "Play video"}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65 sm:right-8 sm:top-8"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-8 px-6 pb-10 sm:px-12 sm:pb-14 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-4xl">
          <div className="mb-3 text-sm font-medium uppercase tracking-[0.12em] text-white/80 sm:text-base">{eyebrow}</div>
          <h1 className="font-display text-5xl leading-[1.02] tracking-[-0.04em] sm:text-7xl lg:text-8xl">{story.title}</h1>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 rounded-[28px] bg-[#252527]/90 py-3 pl-6 pr-3 backdrop-blur-xl sm:rounded-full">
          <span className="text-sm text-white/90 sm:text-base">
            {words.toLocaleString()} words · {minutes} min at {wpm} wpm
          </span>
          <button onClick={onReadBelow} className="text-sm text-white/70 transition-colors hover:text-white sm:text-base">Read below ↓</button>
          <Button onClick={onStart} className="h-11 px-6 text-base text-white hover:opacity-90" style={{ backgroundColor: BRAND_BLUE }}>
            Start reading
          </Button>
        </div>
      </div>
    </section>
  );
}
