"use client";

import React, { useEffect, useState } from "react";
import Grainient from "@/components/ui/Grainient";
import { getBackground, urlFor, type BackgroundItem } from "@/lib/landingMedia";
import type { LandingTheme } from "@/lib/landingTheme";

/** Non-default landing backgrounds: the Grainient gradient, or an uploaded photo/video. */
export function LandingBackground({ theme }: { theme: LandingTheme }) {
  const [item, setItem] = useState<BackgroundItem | null>(null);
  const mediaId = theme.mode === "media" ? theme.mediaId : undefined;

  useEffect(() => {
    let live = true;
    setItem(null);
    if (mediaId) void getBackground(mediaId).then((b) => { if (live) setItem(b); });
    return () => { live = false; };
  }, [mediaId]);

  return (
    <>
      {theme.mode === "grainient" && (
        <Grainient
          colors={["#120f17", "#2a0f0a", "#9a3412", "#f97316", "#fed7aa"]}
          angle={55}
          flow={0.8}
          silk={0.35}
          grainAmount={0.04}
          type="linear"
          bands={1}
          softness={1}
          scale={1}
          speed={0}
          grainSize={1.2}
          grainAnimated={false}
          contrast={1}
          saturation={1}
          variation={5}
          interactive={false}
          stir={1}
          clickSwirl={false}
          intro
          lightMode={false}
        />
      )}
      {theme.mode === "media" && item && item.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlFor(item)} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {theme.mode === "media" && item && item.kind === "video" && (
        <video src={urlFor(item)} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline aria-hidden />
      )}
    </>
  );
}
