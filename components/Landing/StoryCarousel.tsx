"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LatestStoryCard } from "@/components/Landing/LatestStoryCard";
import { getAllStories } from "@/lib/storyLibrary";
import { rankStoriesByInterest } from "@/lib/devData/contentMeta";
import { devDataStore } from "@/lib/devData/store";
import { useDevStoreVersion } from "@/lib/devData/useDevStore";
import type { StoryData } from "@/types";

const MAX_CARDS = 7;

function Card({ story }: { story: StoryData }) {
  // The tall promo-style card (see LatestStoryCard); its white pill starts auto-scroll reading.
  return (
    <li className="w-[82vw] max-w-[440px] shrink-0 snap-start sm:w-[420px]">
      <LatestStoryCard story={story} />
    </li>
  );
}

/**
 * "The latest." — a horizontal, snap-scrolling row of up to seven story cards
 * with round previous/next buttons, shown right under the hero.
 */
export function StoryCarousel() {
  useDevStoreVersion();
  const user = devDataStore.getCurrentUser();
  const stories = useMemo(
    () => rankStoriesByInterest(getAllStories(), user?.interests ?? []).slice(0, MAX_CARDS),
    [user?.id, user?.interests],
  );

  const scroller = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, stories.length]);

  if (stories.length === 0) return null;

  function page(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = (card?.getBoundingClientRect().width ?? 400) + 24;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  const arrow =
    "absolute top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-overlay/10 bg-canvas-raised/90 text-ink shadow-themed backdrop-blur transition-opacity hover:bg-canvas-raised";

  return (
    <section aria-labelledby="latest-h" className="relative z-10 mb-16 bg-white pb-16 pt-8 sm:mb-24 sm:pb-24 sm:pt-10">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <h2 id="latest-h" className="mb-10 font-display text-3xl !font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
          <span className="bg-gradient-to-r from-accent-slow to-accent-medium bg-clip-text text-transparent">The latest.</span>{" "}
          <span className="text-ink-muted">Fresh reads picked for you.</span>
        </h2>
      </div>

      <div className="relative">
        <ul
          ref={scroller}
          onScroll={update}
          className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-6 pb-12 pt-2 [scroll-padding-inline:max(1.5rem,calc((100vw-72rem)/2+2rem))] sm:px-[max(2rem,calc((100vw-72rem)/2+2rem))]"
        >
          {stories.map((s) => <Card key={s.id ?? s.title} story={s} />)}
        </ul>
        {/* Glass covers outside the two vertical guide lines, between the cards and the arrows. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[max(0px,calc((100%-72rem)/2))] bg-white/30 backdrop-blur-md" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[max(0px,calc((100%-72rem)/2))] bg-white/30 backdrop-blur-md" />
        <button type="button" onClick={() => page(-1)} aria-label="Previous stories" disabled={!canPrev} className={`${arrow} left-4 sm:left-6 ${canPrev ? "" : "pointer-events-none opacity-0"}`}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => page(1)} aria-label="Next stories" disabled={!canNext} className={`${arrow} right-4 sm:right-6 ${canNext ? "" : "pointer-events-none opacity-0"}`}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
