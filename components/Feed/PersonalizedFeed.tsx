"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { StoryCard } from "@/components/Search/StoryCard";
import { getAllStories } from "@/lib/storyLibrary";
import { rankStoriesByInterest } from "@/lib/devData/contentMeta";
import { devDataStore } from "@/lib/devData/store";
import { useDevStoreVersion } from "@/lib/devData/useDevStore";

/** How many cards load per page/scroll-step — see ContentFeed.tsx's note on
 *  why this is small and deliberate rather than "render everything." */
const PAGE_SIZE = 6;

interface PersonalizedFeedProps {
  /** Whose interests to rank the feed by. Defaults to the signed-in dev
   *  user, but can be pointed at *any* stable user id — e.g. a future
   *  "what would User 5's feed look like" admin/preview view, or a
   *  profile page that wants to show "more like what they read" — without
   *  that caller needing to know anything about ranking or pagination. */
  userId?: string;
  /** Shown above the grid; omit for no heading (e.g. when embedding this
   *  inside a section that already has its own heading). */
  heading?: string;
  className?: string;
}

/**
 * A standalone, reusable "feed for one specific person" component —
 * separated out from `ContentFeed.tsx` (which is now a thin wrapper around
 * this for the landing page specifically) so any screen in the app can
 * drop in "this person's interest-ranked feed" without re-implementing the
 * ranking, pagination, or card grid. Ranking is pure and stable (see
 * `rankStoriesByInterest` in `lib/devData/contentMeta.ts`): stories whose
 * topics overlap the target user's `interests` surface first, by stable
 * `contentId` — never by array position — with everything else keeping
 * its original order rather than being hidden.
 *
 * Pagination is the same infinite-scroll-via-IntersectionObserver pattern
 * as the original ContentFeed: fixed `PAGE_SIZE` slices, so swapping the
 * `.slice()` for a real paginated API call later is a one-function change.
 */
export function PersonalizedFeed({ userId, heading, className = "" }: PersonalizedFeedProps) {
  useDevStoreVersion();
  const user = userId ? devDataStore.findUserById(userId) : devDataStore.getCurrentUser();

  const rankedStories = useMemo(() => {
    const stories = getAllStories();
    return rankStoriesByInterest(stories, user?.interests ?? []);
  }, [user?.id, user?.interests]);

  const [visibleCount, setVisibleCount] = useState(Math.min(PAGE_SIZE, rankedStories.length));
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination whenever the target person (and therefore the
  // ranking) changes, rather than keeping a stale visibleCount from a
  // previous user's feed.
  useEffect(() => {
    setVisibleCount(Math.min(PAGE_SIZE, rankedStories.length));
  }, [rankedStories]);

  const visibleStories = rankedStories.slice(0, visibleCount);
  const hasMore = visibleCount < rankedStories.length;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLoadingMore(true);
          window.setTimeout(() => {
            setVisibleCount((c) => Math.min(c + PAGE_SIZE, rankedStories.length));
            setLoadingMore(false);
          }, 250);
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, rankedStories.length]);

  if (rankedStories.length === 0) return null;

  return (
    <div className={className}>
      {heading && (
        <h2 className="mb-5 text-xs font-medium uppercase tracking-wide text-ink-muted">{heading}</h2>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {visibleStories.map((story, i) => (
          <motion.div
            key={story.id ?? story.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.25, delay: Math.min(i % PAGE_SIZE, 5) * 0.03 }}
          >
            <StoryCard story={story} />
          </motion.div>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-overlay/20 border-t-ink-muted" />
          )}
        </div>
      )}
    </div>
  );
}
