"use client";

import React from "react";
import { Bookmark, ThumbsDown, ThumbsUp } from "lucide-react";
import { SaveToPlaylistPopover } from "@/components/Search/SaveToPlaylistPopover";
import { ShareModal } from "@/components/Content/ShareModal";
import { CommentPanel } from "@/components/Content/CommentPanel";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";

interface ContentActionsProps {
  contentId: string;
  className?: string;
}

/**
 * The one, shared row of content actions — Like, Dislike, Save, Playlist,
 * Share, Comment — used by both `StoryCard` (the feed's compact card) and
 * `Dashboard` (the full content page a shared-notification click lands
 * on). Built once here rather than duplicated in both places, so "the
 * newly opened content from a notification must use the same underlying
 * action logic" (Phase 9) is true by construction: there is only one
 * implementation of this logic to run.
 *
 * Every action is keyed by the stable `contentId` plus the current
 * (development) user's id, reads/writes the centralized `devDataStore`,
 * and is dedup-safe (liking twice doesn't create two records, saving
 * twice un-saves instead of duplicating) — see store.ts for each method's
 * guarantees.
 */
export function ContentActions({ contentId, className = "" }: ContentActionsProps) {
  const currentUser = useCurrentUser();
  useDevStoreVersion();

  if (!currentUser) return null;

  const userId = currentUser.id;
  const reaction = devDataStore.getReaction(contentId, userId);
  const { like, dislike } = devDataStore.reactionCounts(contentId);
  const saved = devDataStore.isSaved(contentId, userId);

  function react(next: "like" | "dislike") {
    devDataStore.setReaction(contentId, userId, reaction === next ? null : next);
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={() => react("like")}
        aria-pressed={reaction === "like"}
        aria-label="Like"
        title="Like"
        className={`flex h-8 items-center gap-1.5 rounded-full px-2 transition-colors ${
          reaction === "like" ? "text-accent-medium" : "text-ink-muted hover:bg-overlay/5 hover:text-ink"
        }`}
      >
        <ThumbsUp className="h-4 w-4" />
        {like > 0 && <span className="text-xs">{like}</span>}
      </button>
      <button
        onClick={() => react("dislike")}
        aria-pressed={reaction === "dislike"}
        aria-label="Dislike"
        title="Dislike"
        className={`flex h-8 items-center gap-1.5 rounded-full px-2 transition-colors ${
          reaction === "dislike" ? "text-accent-extreme" : "text-ink-muted hover:bg-overlay/5 hover:text-ink"
        }`}
      >
        <ThumbsDown className="h-4 w-4" />
        {dislike > 0 && <span className="text-xs">{dislike}</span>}
      </button>
      <button
        onClick={() => devDataStore.toggleSave(contentId, userId)}
        aria-pressed={saved}
        aria-label={saved ? "Unsave" : "Save"}
        title={saved ? "Unsave" : "Save"}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          saved ? "text-accent-fast" : "text-ink-muted hover:bg-overlay/5 hover:text-ink"
        }`}
      >
        <Bookmark className={saved ? "h-4 w-4 fill-current" : "h-4 w-4"} />
      </button>
      <SaveToPlaylistPopover storyId={contentId} />
      <ShareModal contentId={contentId} />
      <CommentPanel contentId={contentId} />
    </div>
  );
}
