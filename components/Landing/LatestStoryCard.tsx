"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock3, MoreHorizontal, Pencil, User } from "lucide-react";
import { ContentActions } from "@/components/Content/ContentActions";
import { EditStoryModal } from "@/components/Content/EditStoryModal";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { storage } from "@/lib/storage";
import { isCustomStory } from "@/lib/storyLibrary";
import { getContentAuthorId } from "@/lib/devData/contentMeta";
import { devDataStore } from "@/lib/devData/store";
import { useDevStoreVersion } from "@/lib/devData/useDevStore";
import { StoryData } from "@/types";
import { ROUTES } from "@/lib/routes";
import { startSwitchLoader } from "@/lib/switchLoader";
import { useNavLoader } from "@/contexts/NavLoaderContext";
import { safeThumbnail } from "@/lib/thumbnail";
import { isVideoRef } from "@/lib/thumbnailVideo";
import { HoverCoverVideo } from "@/components/Search/HoverCoverVideo";
import { coverFor, coverTitle } from "@/components/Search/StoryCard";
import { BRAND_NAME } from "@/lib/brand";

/**
 * A story card for the landing page's "The latest." row, in the style of a tall promo tile: a rounded card with a
 * soft colour gradient, a large title and description at the top, the cover art in the middle and one white pill
 * button at the bottom (start reading). Everything else the regular StoryCard offers (open the story page, author,
 * level, reading time, Edit for the owner, and the Like / Dislike / Save / Share actions) lives in the 3-dot menu
 * at the top right, so nothing is lost. Other screens keep the regular StoryCard.
 */
export function LatestStoryCard({ story: initialStory }: { story: StoryData }) {
  const dispatch = useReadingDispatch();
  useDevStoreVersion();
  const nav = useNavLoader();
  const [story, setStory] = useState(initialStory);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [coverHover, setCoverHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const storyId = story.id ?? story.title;
  const authorId = getContentAuthorId(storyId);
  const author = devDataStore.findUserById(authorId);
  const isOwner = isCustomStory(story.id);

  // The menu closes on a click outside it or on Escape (popovers opened from inside it, like Share, count as inside).
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (deleted) return null;

  function openStory() {
    dispatch({ type: "LOAD_STORY", story });
    storage.addSearchHistory(story.title);
    startSwitchLoader("reading", ROUTES.story(story.id ?? story.title));
    nav.push(ROUTES.story(story.id ?? story.title));
  }

  function startReader() {
    dispatch({ type: "LOAD_STORY", story });
    dispatch({ type: "PLAY" });
    storage.addSearchHistory(story.title);
    startSwitchLoader("reading", "/reader");
    nav.push("/reader");
  }

  const level = story.difficulty ?? story.level;
  const minutes = story.estimatedReadingTime;
  const cover = coverFor(storyId);
  const thumb = safeThumbnail(story.thumbnail);
  const label = story.tags?.[0] ?? level ?? "Story";
  // Text colour: white over a photo, otherwise the cover palette's own ink (dark on light covers, light on dark ones).
  const ink = thumb ? "#FFFFFF" : cover.ink;
  const background = thumb
    ? "#1d2b27"
    : cover.kind === "tilt"
      ? `linear-gradient(180deg, ${cover.bg} 0%, ${cover.bg} 45%, ${cover.card} 100%)`
      : cover.shape;

  return (
    <article
      className="group relative isolate flex aspect-[3/4] w-full flex-col rounded-[44px] p-7 shadow-[0_30px_60px_-24px_rgba(20,20,40,0.35)] transition-shadow duration-300 hover:shadow-[0_36px_70px_-22px_rgba(20,20,40,0.42)] sm:p-8"
      style={{ color: ink }}
    >
      {/* Background: the cover colours (or the cover photo), clipped to the card's rounded shape. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]" style={{ background }}>
        {thumb && (
          <>
            {coverHover && isVideoRef(story.thumbnailVideo) && <HoverCoverVideo videoRef={story.thumbnailVideo} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/5 to-black/45" />
          </>
        )}
        {!thumb && cover.kind === "bold" && (
          <span className="absolute -right-[12%] top-[30%] h-[46%] w-[62%] rotate-[18deg] rounded-[40px]" style={{ background: cover.shape2 }} />
        )}
      </div>

      {/* Top: tag, title and description. */}
      <div className="relative pr-12">
        <div className="text-base opacity-75">{label}</div>
        <button type="button" onClick={openStory} className="mt-1 block text-left" aria-label={`Read ${story.title}`}>
          <h3 className="line-clamp-3 font-display text-[32px] !font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[36px]">{story.title}</h3>
        </button>
        {story.description && <p className="mt-3 line-clamp-3 text-base leading-snug opacity-70">{story.description}</p>}
      </div>

      {/* Middle: the cover art (opens the story, like the regular card's cover). */}
      <button
        type="button"
        onClick={openStory}
        aria-label={`Open ${story.title}`}
        tabIndex={-1}
        className="relative my-4 flex min-h-0 flex-1 items-center justify-center [container-type:inline-size]"
        onMouseEnter={() => setCoverHover(true)}
        onMouseLeave={() => setCoverHover(false)}
      >
        {!thumb && cover.kind === "tilt" && (
          <span
            aria-hidden
            className="flex max-w-[70%] -rotate-[6deg] items-center rounded-[6cqw] px-[6cqw] py-[4.5cqw] shadow-[0_3cqw_8cqw_-2cqw_rgba(0,0,0,0.28)] transition-transform duration-300 group-hover:-rotate-[3deg]"
            style={{ background: cover.card, color: cover.ink }}
          >
            <span className="line-clamp-3 pb-[0.1em] font-display text-[11cqw] !font-medium leading-[0.98] tracking-[-0.05em]">{coverTitle(story.title)}</span>
          </span>
        )}
        {!thumb && cover.kind === "bold" && (
          <span aria-hidden className="line-clamp-3 pb-[0.12em] font-display text-[15cqw] !font-medium leading-[0.97] tracking-[-0.05em] opacity-90 transition-transform duration-300 group-hover:-translate-y-1">
            {coverTitle(story.title)}
          </span>
        )}
      </button>

      {/* Bottom: one white pill, like "Let's go". */}
      <button
        type="button"
        onClick={startReader}
        aria-label="Start auto-scroll reading"
        className="relative flex h-14 w-full shrink-0 items-center justify-center rounded-full bg-white text-base font-semibold text-[#16171a] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.3)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Start reading
      </button>

      {/* 3-dot menu: every other action of the regular card. */}
      <div ref={menuRef} className="absolute right-6 top-6 z-20 sm:right-7 sm:top-7">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 text-current ring-1 ring-white/40 backdrop-blur-md transition-colors hover:bg-white/50"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-12 w-72 max-w-[calc(100vw-3rem)] rounded-2xl border border-overlay/10 bg-canvas-raised/95 p-2 text-ink shadow-themed backdrop-blur-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); openStory(); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-overlay/5"
            >
              <BookOpen className="h-4 w-4 text-ink-muted" /> Open story page
            </button>
            <Link
              href={`/profile/${authorId}`}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-overlay/5"
            >
              <User className="h-4 w-4 text-ink-muted" /> {author?.name ?? story.author ?? BRAND_NAME}
            </Link>
            {isOwner && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); setEditing(true); }}
                aria-label="Edit story"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-overlay/5"
              >
                <Pencil className="h-4 w-4 text-ink-muted" /> Edit
              </button>
            )}
            {(level || typeof minutes === "number") && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-ink-faint">
                {level && <span className="rounded-full border border-overlay/10 px-2 py-0.5 text-ink-muted">{level}</span>}
                {typeof minutes === "number" && (
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3 w-3" /> {minutes} min
                  </span>
                )}
              </div>
            )}
            <div className="mt-1 border-t border-overlay/10 px-1 pt-2">
              <ContentActions contentId={storyId} className="flex-wrap" />
            </div>
          </div>
        )}
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
