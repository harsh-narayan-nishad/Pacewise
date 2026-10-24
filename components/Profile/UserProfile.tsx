"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, UserCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StoryCard } from "@/components/Search/StoryCard";
import { getAllStories } from "@/lib/storyLibrary";
import { getContentAuthorId } from "@/lib/devData/contentMeta";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";

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
      className="mx-auto max-w-5xl px-6 py-10 sm:px-8"
    >
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl text-ink">{user.name}</h1>
            <p className="text-sm text-ink-muted">
              {devDataStore.followerCount(userId)} followers · {devDataStore.followingCount(userId)} following
              {user.isDemoUser && <span className="ml-2 text-xs text-ink-faint">(development account)</span>}
            </p>
          </div>
        </div>

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

      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-muted">
        Content posted by {isSelf ? "you" : user.name}
      </h2>

      {authoredStories.length === 0 ? (
        <p className="text-sm text-ink-muted">No content from this user yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {authoredStories.map((story) => (
            <StoryCard key={story.id ?? story.title} story={story} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
