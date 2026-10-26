"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, UserCheck, UserPlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryData } from "@/types";
import { storyWordCount } from "@/lib/wpmCalculator";
import { isCustomStory } from "@/lib/storyLibrary";
import { ContentActions } from "@/components/Content/ContentActions";
import { EditStoryModal } from "@/components/Content/EditStoryModal";
import { getContentAuthorId } from "@/lib/devData/contentMeta";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { StoryHero } from "@/components/Dashboard/StoryHero";
import { ReadingModePage } from "@/components/ReadingMode/ReadingModePage";

interface DashboardProps {
  story: StoryData;
  selectedWpm: number;
  streak: number;
  onStart: () => void;
}

export function Dashboard({ story: initialStory, selectedWpm, streak, onStart }: DashboardProps) {
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

  function readBelow() {
    document.getElementById("story-article")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Hero: the story's uploaded video (thumbnail as poster) plays here. */}
      <StoryHero
        story={story}
        words={wordCount}
        minutes={estMinutes}
        wpm={selectedWpm}
        eyebrow={`${streak} day streak`}
        onStart={onStart}
        onReadBelow={readBelow}
      />

      <div className="mx-auto max-w-3xl px-6 pt-10">
        {/* Author byline + follow + shared content-actions row. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-overlay/10 pb-4">
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

      {/* The whole story, shown as reading mode by default — no toggling. */}
      <ReadingModePage story={story} embedded />

      <div className="pb-24" />
    </motion.div>
  );
}
