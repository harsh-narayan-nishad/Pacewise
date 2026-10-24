"use client";
import { BRAND_NAME } from "@/lib/brand";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Clock3, Pencil, User } from "lucide-react";
import { ContentActions } from "@/components/Content/ContentActions";
import { EditStoryModal } from "@/components/Content/EditStoryModal";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { storage } from "@/lib/storage";
import { isCustomStory } from "@/lib/storyLibrary";
import { getContentAuthorId } from "@/lib/devData/contentMeta";
import { devDataStore } from "@/lib/devData/store";
import { useDevStoreVersion } from "@/lib/devData/useDevStore";
import { StoryData } from "@/types";
import { safeThumbnail } from "@/lib/thumbnail";

type Cover =
  | { kind: "tilt"; bg: string; card: string; ink: string; shape: string; shape2: string }
  | { kind: "bold"; bg: string; ink: string; shape: string; shape2: string };

/** Fixed (theme-independent) cover palettes, picked by a stable hash of the story id. */
const COVERS: Cover[] = [
  { kind: "tilt", bg: "#ECE3D3", card: "#F8F6EE", ink: "#2F3A2E", shape: "#B9BBBE", shape2: "#F4F2EC" },
  { kind: "bold", bg: "#1F2723", ink: "#FFFFFF", shape: "linear-gradient(160deg,#2C3A33 0%,#18201C 100%)", shape2: "rgba(120,150,125,0.28)" },
  { kind: "tilt", bg: "#E4DDEE", card: "#F8F6EE", ink: "#3A3148", shape: "#CFC4E0", shape2: "#F1ECF7" },
  { kind: "bold", bg: "#3F5646", ink: "#F4F0E4", shape: "linear-gradient(160deg,#486152 0%,#34493C 100%)", shape2: "rgba(244,240,228,0.14)" },
  { kind: "tilt", bg: "#EEDACD", card: "#FBF7F0", ink: "#4A2E24", shape: "#D9B9A6", shape2: "#F7EBE3" },
  { kind: "bold", bg: "#2A3139", ink: "#F2F4F7", shape: "linear-gradient(160deg,#343E48 0%,#20262C 100%)", shape2: "rgba(140,165,190,0.22)" },
  { kind: "tilt", bg: "#D9E5DD", card: "#F7F8F2", ink: "#23392D", shape: "#B3C9BA", shape2: "#EEF3EF" },
  { kind: "bold", bg: "#4A3B58", ink: "#F6F1FA", shape: "linear-gradient(160deg,#58476A 0%,#3B2E48 100%)", shape2: "rgba(220,200,240,0.18)" },
];

function coverFor(id: string): Cover {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVERS[h % COVERS.length];
}

/** Short, sentence-style cover line: first ~3 words of the title, with a full stop. */
function coverTitle(title: string): string {
  const words = title.replace(/[.:!?]+$/, "").split(/\s+/).filter(Boolean);
  const short = words.slice(0, 3).join(" ");
  return `${short}${words.length > 3 ? "…" : "."}`;
}

interface StoryCardProps {
  story: StoryData;
}

/**
 * One card in the landing page's scroll-reveal feed (see ContentFeed.tsx).
 * Built from the app's existing primitives (Card/Button, the same
 * canvas/ink/overlay tokens everything else uses) rather than a new visual
 * language, per the brief's "extend, don't redesign" constraint.
 *
 * Like/Dislike/Save/Playlist/Share/Comment are all delegated to the one
 * shared `ContentActions` row (also used on the Dashboard content page) —
 * this card no longer owns any of that logic itself, so there's exactly
 * one implementation of each action to keep correct.
 */
export function StoryCard({ story: initialStory }: StoryCardProps) {
  const router = useRouter();
  const dispatch = useReadingDispatch();
  useDevStoreVersion();
  const [story, setStory] = useState(initialStory);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const storyId = story.id ?? story.title;
  const authorId = getContentAuthorId(storyId);
  const author = devDataStore.findUserById(authorId);
  // Only the browser that uploaded this story can edit/delete it — custom
  // stories are per-browser localStorage content (see lib/storyLibrary.ts),
  // so "owned by the uploader" and "a custom story in this browser" are
  // the same thing here; a built-in story is never editable.
  const isOwner = isCustomStory(story.id);

  if (deleted) return null;

  function openStory() {
    dispatch({ type: "LOAD_STORY", story });
    storage.addSearchHistory(story.title);
    router.push("/");
  }

  const level = story.difficulty ?? story.level;
  const minutes = story.estimatedReadingTime;
  const cover = coverFor(storyId);
  const thumb = safeThumbnail(story.thumbnail);
  const label = story.tags?.[0] ?? level ?? "Story";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-overlay/10 bg-canvas-raised transition-shadow duration-200 hover:shadow-themed">
      {/* Cover — big tinted panel with the title set large, like a project card */}
      <button
        onClick={openStory}
        aria-label={`Read ${story.title}`}
        className="relative block aspect-[3/2] w-full overflow-hidden text-left [container-type:inline-size]"
        style={{ background: cover.bg }}
      >
        {thumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <span className="absolute inset-x-[8%] bottom-[8%] line-clamp-3 pb-[0.12em] font-display text-[11.5cqw] !font-medium leading-[0.97] tracking-[-0.05em] text-white">
              {coverTitle(story.title)}
            </span>
          </>
        ) : cover.kind === "tilt" ? (
          <>
            <span aria-hidden className="absolute -right-[6%] top-[6%] h-[88%] w-[62%] rotate-[3deg] rounded-[5cqw]" style={{ background: cover.shape }} />
            <span aria-hidden className="absolute bottom-[-8%] right-[8%] h-[34%] w-[30%] rounded-t-[50%]" style={{ background: cover.shape2 }} />
            <span
              className="absolute left-[7%] top-[28%] flex max-w-[56%] -rotate-[4deg] items-center rounded-[4cqw] px-[5cqw] py-[3.5cqw] shadow-[0_2cqw_6cqw_-2cqw_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:-rotate-[2deg]"
              style={{ background: cover.card, color: cover.ink }}
            >
              <span className="line-clamp-3 pb-[0.1em] font-display text-[10.5cqw] !font-medium leading-[0.98] tracking-[-0.05em]">{coverTitle(story.title)}</span>
            </span>
          </>
        ) : (
          <>
            <span aria-hidden className="absolute inset-0" style={{ background: cover.shape }} />
            <span aria-hidden className="absolute -right-[10%] -top-[18%] h-[80%] w-[55%] rotate-[18deg] rounded-[6cqw]" style={{ background: cover.shape2 }} />
            <span className="absolute inset-x-[8%] bottom-[8%] line-clamp-3 pb-[0.12em] font-display text-[11.5cqw] !font-medium leading-[0.97] tracking-[-0.05em]" style={{ color: cover.ink }}>
              {coverTitle(story.title)}
            </span>
          </>
        )}
      </button>

      {/* Caption */}
      <div className="flex flex-1 flex-col gap-4 px-6 pb-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-ink-muted">{label}</div>
            <button onClick={openStory} className="mt-1 block text-left">
              <h3 className="line-clamp-2 font-display text-2xl !font-normal leading-[1.1] tracking-[-0.03em] text-ink">{story.title}</h3>
            </button>
            {story.description && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{story.description}</p>}
          </div>
          <button
            onClick={openStory}
            aria-label="Open story"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-overlay/15 text-ink transition-colors hover:bg-ink hover:text-canvas"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-auto space-y-3 border-t border-overlay/10 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
            <Link href={`/profile/${authorId}`} className="flex items-center gap-1 transition-colors hover:text-ink">
              <User className="h-3 w-3" /> {author?.name ?? story.author ?? BRAND_NAME}
            </Link>
            {level && <span className="rounded-full border border-overlay/10 px-2 py-0.5 text-ink-muted">{level}</span>}
            {typeof minutes === "number" && (
              <span className="flex items-center gap-1">
                <Clock3 className="h-3 w-3" /> {minutes} min
              </span>
            )}
            {isOwner && (
              <button onClick={() => setEditing(true)} aria-label="Edit story" className="ml-auto flex items-center gap-1 text-ink-muted transition-colors hover:text-ink">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
          <ContentActions contentId={storyId} className="flex-wrap" />
        </div>
      </div>

      {editing && (
        <EditStoryModal
          story={story}
          onClose={() => setEditing(false)}
          onSaved={(updated) => setStory(updated)}
          onDeleted={() => setDeleted(true)}
        />
      )}
    </article>
  );
}
