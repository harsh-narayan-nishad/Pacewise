"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Clock, HelpCircle, Layers, Bookmark, Flame, Gauge, TrendingUp, Coffee, Timer, BookCheck, Zap, User, UserCheck, UserPlus, Pencil, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StoryData } from "@/types";
import { formatShortDuration, storyWordCount, WPM_PRESETS } from "@/lib/wpmCalculator";
import { storage } from "@/lib/storage";
import { isCustomStory } from "@/lib/storyLibrary";
import { ContentActions } from "@/components/Content/ContentActions";
import { EditStoryModal } from "@/components/Content/EditStoryModal";
import { getContentAuthorId } from "@/lib/devData/contentMeta";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";
import { useReadingDispatch } from "@/contexts/ReadingContext";

interface DashboardProps {
  story: StoryData;
  selectedWpm: number;
  streak: number;
  isBookmarked: boolean;
  onSelectWpm: (wpm: number) => void;
  onStart: () => void;
  onToggleBookmark: () => void;
}

export function Dashboard({ story: initialStory, selectedWpm, streak, isBookmarked, onSelectWpm, onStart, onToggleBookmark }: DashboardProps) {
  const router = useRouter();
  const dispatch = useReadingDispatch();
  const [story, setStory] = useState(initialStory);
  const [editing, setEditing] = useState(false);
  // Only the uploader can edit/delete — see StoryCard.tsx's identical
  // isCustomStory ownership check for why that's the right notion of
  // "owner" for a story that lives in this browser's localStorage.
  const isOwner = isCustomStory(story.id);
  const wordCount = storyWordCount(story);
  const estMinutes = Math.max(1, Math.round(wordCount / selectedWpm));

  // Content actions (Like/Dislike/Save/Playlist/Share/Comment) + author/
  // follow block: this is the page a shared-notification click lands the
  // recipient on (see Phase 7 of the social-features brief), so it needs
  // the exact same action row as the feed's StoryCard — reused via
  // ContentActions rather than re-implemented — plus a way to view/follow
  // whichever dev user "posted" this story (getContentAuthorId, a
  // development-only stand-in for a real content-authorship field; see
  // lib/devData/contentMeta.ts).
  const contentId = story.id ?? story.title;
  const authorId = getContentAuthorId(contentId);
  const currentUser = useCurrentUser();
  useDevStoreVersion();
  const author = devDataStore.findUserById(authorId);
  const isOwnContent = currentUser?.id === authorId;
  const isFollowingAuthor = currentUser ? devDataStore.isFollowing(currentUser.id, authorId) : false;

  // Self-fetched, client-only — same pattern as ContributionHeatmap/
  // EfficiencyTrends: a component that needs real session history reads
  // storage directly on mount rather than having it threaded through
  // page-level props, and both this block and the calendar's stats row
  // call the exact same `storage.getLifetimeStats()` (see lib/storage.ts)
  // so the two surfaces can never disagree on a number.
  const [lifetime, setLifetime] = useState<ReturnType<typeof storage.getLifetimeStats> | null>(null);

  useEffect(() => {
    setLifetime(storage.getLifetimeStats());
  }, []);

  const realStats = [
    { icon: Zap, label: "Effective WPM", value: lifetime?.avgEffectiveWpm ? Math.round(lifetime.avgEffectiveWpm).toString() : "—" },
    { icon: Gauge, label: "Selected WPM", value: selectedWpm.toString() },
    {
      icon: TrendingUp,
      label: "Reading efficiency",
      value: lifetime ? `${lifetime.readingEfficiency}%` : "—",
    },
    {
      icon: Coffee,
      label: "Avg. break time",
      value: lifetime && lifetime.avgBreakMs > 0 ? formatShortDuration(lifetime.avgBreakMs) : "—",
    },
    {
      icon: Timer,
      label: "Total break time",
      value: lifetime && lifetime.totalBreakMs > 0 ? formatShortDuration(lifetime.totalBreakMs) : "0s",
    },
    {
      icon: Clock,
      label: "Reading time",
      value: lifetime ? formatShortDuration(lifetime.totalMinutes * 60_000) : "—",
    },
    { icon: BookCheck, label: "Stories completed", value: lifetime?.totalStoriesCompleted.toString() ?? "—" },
    { icon: Flame, label: "Current streak", value: `${streak} ${streak === 1 ? "day" : "days"}` },
  ];

  // A media story (uploaded PDF/image — see lib/mediaStory.ts) has no
  // paragraphs; show its page count under the same stat slot instead, so
  // this grid reads sensibly for either content type without adding a
  // separate layout for media stories.
  const storyStats = [
    story.media
      ? { icon: Layers, label: "Pages", value: story.media.pages.length }
      : { icon: Layers, label: "Paragraphs", value: story.story.length },
    { icon: HelpCircle, label: "Questions", value: story.questions.length },
    { icon: Clock, label: "Est. time", value: `${estMinutes} min` },
    { icon: BookOpen, label: "Level", value: story.level },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16"
    >
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted">
        <Flame className="h-3.5 w-3.5 text-accent-fast" />
        {streak} day streak
      </div>
      <h1 className="mb-2 font-display text-4xl leading-tight text-ink sm:text-5xl">{story.title}</h1>
      <p className="mb-4 text-ink-muted">{wordCount.toLocaleString()} words · reading level {story.level}</p>

      {/* Author byline + follow/unfollow + the shared content-actions row
          (Like/Dislike/Save/Playlist/Share/Comment) — new for this phase,
          laid out as its own compact bar rather than reworking the
          existing stats grid below it. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-overlay/10 pb-4">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href={`/profile/${authorId}`} className="flex items-center gap-1.5 transition-colors hover:text-ink">
            <User className="h-3.5 w-3.5" />
            {author?.name ?? "Unknown author"}
          </Link>
          {!isOwnContent && currentUser && (
            <Button
              size="sm"
              variant={isFollowingAuthor ? "outline" : "primary"}
              onClick={() => devDataStore.toggleFollow(currentUser.id, authorId)}
            >
              {isFollowingAuthor ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {isFollowingAuthor ? "Following" : "Follow"}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ContentActions contentId={contentId} className="flex-wrap" />
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <EditStoryModal
          story={story}
          onClose={() => setEditing(false)}
          onSaved={(updated) => setStory(updated)}
          onDeleted={() => {
            dispatch({ type: "CLEAR_STORY" });
            router.push("/");
          }}
        />
      )}

      {/* First statistics container: real numbers derived from
          storage.getLifetimeStats() (actual past sessions), not story
          metadata placeholders. */}
      <div className="mb-6">
        <div className="mb-2 text-xs uppercase tracking-widest text-ink-muted">Your reading stats</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {realStats.map((s) => (
            <Card key={s.label} className="flex flex-col items-start gap-1.5 p-4">
              <s.icon className="h-4 w-4 text-ink-muted" />
              <span className="text-lg font-medium text-ink">{s.value}</span>
              <span className="text-xs text-ink-muted">{s.label}</span>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-2 text-xs uppercase tracking-widest text-ink-muted">About this story</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {storyStats.map((s) => (
            <Card key={s.label} className="flex flex-col items-start gap-1.5 p-4">
              <s.icon className="h-4 w-4 text-ink-muted" />
              <span className="text-lg font-medium text-ink">{s.value}</span>
              <span className="text-xs text-ink-muted">{s.label}</span>
            </Card>
          ))}
        </div>
      </div>

      {/* Past Test Attempts used to render inline here (TestHistory) —
          moved to its own page (app/history/page.tsx) with real
          pagination, reachable from this button (placed right after the
          stat-card grids above) and from the profile menu. */}
      <Link
        href="/history"
        className="mb-8 flex items-center justify-between gap-2 rounded-xl border border-overlay/10 bg-canvas-raised px-4 py-3 text-sm text-ink transition-colors hover:border-overlay/20"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-ink-muted" /> Past test attempts
        </span>
        <span className="text-xs text-ink-muted">View all →</span>
      </Link>

      <Card className="mb-8">
        <div className="mb-3 text-sm text-ink-muted">Reading speed</div>
        <div className="flex flex-wrap gap-2">
          {WPM_PRESETS.map((p) => (
            <Button key={p} size="sm" variant={selectedWpm === p ? "primary" : "outline"} onClick={() => onSelectWpm(p)}>
              {p}
            </Button>
          ))}
          <input
            type="number"
            value={selectedWpm}
            onChange={(e) => onSelectWpm(Number(e.target.value) || 0)}
            className="h-8 w-24 rounded-full border border-overlay/15 bg-transparent px-3 text-center text-sm text-ink"
            aria-label="Custom WPM"
            placeholder="Custom"
          />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={onStart} className="flex-1">
          Start reading
        </Button>
        <Button size="lg" variant="outline" onClick={onToggleBookmark} aria-label="Bookmark story">
          <Bookmark className={isBookmarked ? "h-4 w-4 fill-current" : "h-4 w-4"} />
        </Button>
      </div>
    </motion.div>
  );
}
