"use client";

import React, { useEffect, useState } from "react";
import { loadThumbnailVideoUrl } from "@/lib/thumbnailVideo";

/** Muted looping video laid over a story card's cover while the cover is hovered. */
export function HoverCoverVideo({ videoRef }: { videoRef: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadThumbnailVideoUrl(videoRef).then((u) => { if (live) setSrc(u); });
    return () => { live = false; };
  }, [videoRef]);
  if (!src) return null;
  return <video src={src} className="absolute inset-0 z-[1] h-full w-full object-cover" autoPlay muted loop playsInline aria-hidden />;
}
