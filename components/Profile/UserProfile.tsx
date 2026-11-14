"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StoryCard } from "@/components/Search/StoryCard";
import { getAllStories } from "@/lib/storyLibrary";
import { getContentAuthorId } from "@/lib/devData/contentMeta";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";
import { HomeDashboard } from "@/components/Dashboard/HomeDashboard";
import { TestAttemptsPanel } from "@/components/Account/TestAttemptsPanel";
import { ReadingHistoryPanel } from "@/components/Account/ReadingHistoryPanel";
import { AnalyticsPanel } from "@/components/Account/AnalyticsPanel";
import { CalendarPanel } from "@/components/Account/CalendarPanel";
import { FollowList } from "@/components/Profile/FollowList";
import { TimeAnalysisPanel } from "@/components/Profile/TimeAnalysisPanel";
import { NotesView } from "@/components/Notes/NotesView";
import { ProfileQr } from "@/components/Profile/ProfileQr";
import { SettingsPanel } from "@/components/Account/SettingsPanel";
import { Avatar } from "@/components/ui/Avatar";
import { useAvatarUpload } from "@/components/Profile/useAvatarUpload";

type ProfileTab = "dashboard" | "calendar" | "notes" | "readingHistory" | "analytics" | "time" | "attempts" | "settings";

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "Calendar" },
  { id: "notes", label: "Notes" },
  { id: "readingHistory", label: "Reading history" },
  { id: "analytics", label: "Analytics" },
  { id: "time", label: "Time spent" },
  { id: "attempts", label: "Past test attempts" },
  { id: "settings", label: "Settings" },
];

interface UserProfileProps {
  userId: string;
}

/**
 * A development dev-user's profile: name, follow/unfollow (the brief's
 * "follow unfollow options" requirement), and every piece of content
 * attributed to them (via the dev-only `getContentAuthorId` mapping — see
 * lib/devData/contentMeta.ts for why content authorship is derived rather
 * than a real field on StoryData). Reached from a story card's or the
 * Dashboard's author byline link (`/profile/[userId]`), and reuses
 * `StoryCard` for each of that user's stories rather than a second grid
 * implementation.
 */
export function UserProfile({ userId }: UserProfileProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  useDevStoreVersion();
  const photo = useAvatarUpload(currentUser?.id);
  /** null = the default "content posted by you" grid. */
  const [tab, setTab] = useState<ProfileTab | null>(null);
  // ?tab=analytics (e.g. from the flip book's week bars) opens that tab
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("tab");
    if (want && TABS.some((t) => t.id === want)) setTab(want as ProfileTab);
  }, []);
  /** Which follow list (followers / following) is open, if any. */
  const [relList, setRelList] = useState<"followers" | "following" | null>(null);

  const user = devDataStore.findUserById(userId);
  const allStories = useMemo(() => getAllStories(), []);
  const authoredStories = useMemo(
    () => allStories.filter((s) => getContentAuthorId(s.id ?? s.title) === userId),
    [allStories, userId]
  );

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-ink-muted">
        <p>No development user found with id &ldquo;{userId}&rdquo;.</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" /> Back home
        </Button>
      </div>
    );
  }

  const isSelf = currentUser?.id === userId;
  const isFollowing = currentUser ? devDataStore.isFollowing(currentUser.id, userId) : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10"
    >
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isSelf ? (
            <button type="button" onClick={photo.choose} disabled={photo.busy} title="Change photo" aria-label="Change profile photo" className="rounded-full transition-opacity hover:opacity-80">
              <Avatar userId={userId} size={64} />
            </button>
          ) : (
            <Avatar userId={userId} size={64} />
          )}
          <div>
            <h1 className="font-display text-xl text-ink">{user.name}</h1>
            <p className="text-sm text-ink-muted">
              <button type="button" onClick={() => setRelList("followers")} className="transition-colors hover:text-ink hover:underline">{devDataStore.followerCount(userId)} followers</button>
              {" · "}
              <button type="button" onClick={() => setRelList("following")} className="transition-colors hover:text-ink hover:underline">{devDataStore.followingCount(userId)} following</button>
              {user.isDemoUser && <span className="ml-2 text-xs text-ink-faint">(development account)</span>}
            </p>
          </div>
        </div>

        {isSelf && (
          <div className="flex items-start gap-3">
            <input ref={photo.inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => void photo.onFile(e.target.files?.[0])} />
            <div className="flex flex-col items-end gap-1">
              {devDataStore.getAvatar(userId) && (
                <Button variant="ghost" size="icon" onClick={photo.remove} aria-label="Remove profile photo">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {photo.error && <p className="text-xs text-accent-extreme">{photo.error}</p>}
            </div>
            <ProfileQr userId={userId} />
          </div>
        )}

        {!isSelf && currentUser && (
          <Button
            variant={isFollowing ? "outline" : "primary"}
            onClick={() => devDataStore.toggleFollow(currentUser.id, userId)}
          >
            {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {isFollowing ? "Following" : "Follow"}
          </Button>
        )}
      </Card>

      {isSelf && (
        <nav aria-label="Your pages" className="mb-8 flex flex-wrap gap-2">
          {TABS.map(({ id, label }) => (
            <Button key={id} size="sm" variant={tab === id ? "primary" : "outline"} aria-pressed={tab === id} onClick={() => setTab(tab === id ? null : id)}>
              {label}
            </Button>
          ))}
        </nav>
      )}

      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {isSelf && tab ? TABS.find((t) => t.id === tab)?.label : <>Content posted by {isSelf ? "you" : user.name}</>}
      </h2>

      {isSelf && tab === "dashboard" && <HomeDashboard />}
      {relList && <FollowList userId={userId} kind={relList} onClose={() => setRelList(null)} />}
      {isSelf && tab === "calendar" && <CalendarPanel />}
      {isSelf && tab === "notes" && <NotesPanel userId={userId} />}
      {isSelf && tab === "readingHistory" && <ReadingHistoryPanel />}
      {isSelf && tab === "analytics" && <AnalyticsPanel />}
      {isSelf && tab === "time" && <TimeAnalysisPanel />}
      {isSelf && tab === "attempts" && <TestAttemptsPanel showHeading={false} />}
      {isSelf && tab === "settings" && <SettingsPanel />}

      {!(isSelf && tab) &&
        (authoredStories.length === 0 ? (
          <p className="text-sm text-ink-muted">No content from this user yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {authoredStories.map((story) => (
              <StoryCard key={story.id ?? story.title} story={story} />
            ))}
          </div>
        ))}
    </motion.div>
  );
}

/** The Notes tab: the notes plus this person's own shareable link. */
function NotesPanel({ userId }: { userId: string }) {
  return (
    <div>
      <p className="mb-6 text-ink-muted">
        Whoever you share these with signs in first, then can read them: scan your QR code at the top of this page, or use <button type="button" className="underline underline-offset-4 hover:text-ink" onClick={() => window.open(`/notes/${encodeURIComponent(userId)}`, "_blank")}>your notes link</button>.
      </p>
      <NotesView />
    </div>
  );
}
