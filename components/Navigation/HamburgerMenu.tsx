"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { resetAllAppData } from "@/lib/resetApp";
import { ChevronDown, Clock, Globe, ListMusic, Lock, Menu, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { storage, SearchHistoryEntry } from "@/lib/storage";
import { getAllStories, searchStories, clearCustomStories } from "@/lib/storyLibrary";
import { groupByDateBucket } from "@/lib/dateGroups";
import { Pagination } from "@/components/ui/Pagination";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";

/**
 * The left-side drawer the brief calls the "hamburger menu" — placed at
 * the leftmost side of the navbar (see TopNav.tsx), and, once built, its
 * position/trigger are what future changes should leave alone.
 *
 * Portal-rendered to `document.body` for the same reason as
 * VoiceSearchOverlay: the navbar's `backdrop-blur` is a CSS `filter`,
 * which creates a containing block for `position: fixed` descendants in
 * modern browsers, so a fixed-height drawer triggered from inside the
 * header would otherwise be clipped to the header's own bounds instead
 * of spanning the viewport.
 *
 * Playlists here read/write the centralized `devDataStore` (lib/devData),
 * scoped to the logged-in dev user — the same data `SaveToPlaylistPopover`
 * on every content card writes to, so a playlist created or modified from
 * either place is immediately visible in the other. Search history is
 * unrelated to this phase's "no browser-only persistence for relationship
 * data" rule (it isn't one of the listed relationship types, and isn't
 * shared across users), so it's left exactly as it was: per-browser, via
 * the existing `lib/storage.ts`.
 */
export function HamburgerMenu() {
  const router = useRouter();
  const dispatch = useReadingDispatch();
  const currentUser = useCurrentUser();
  useDevStoreVersion();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmingClearStories, setConfirmingClearStories] = useState(false);
  const [confirmingResetAll, setConfirmingResetAll] = useState(false);
  const [resetting, setResetting] = useState(false);

  const allStories = useMemo(() => getAllStories(), [open]);
  const storyById = useMemo(() => new Map(allStories.map((s, i) => [s.id ?? `story-${i}`, s])), [allStories]);
  const playlists = currentUser ? devDataStore.listPlaylists(currentUser.id) : [];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setHistory(storage.getSearchHistory());
    setConfirmingClear(false);
    setConfirmingClearStories(false);
    setHistoryPage(1);
  }, [open]);

  const historyGroups = useMemo(() => groupByDateBucket(history, (e) => e.date), [history]);
  const HISTORY_GROUPS_PER_PAGE = 5;
  const historyPageCount = Math.max(1, Math.ceil(historyGroups.length / HISTORY_GROUPS_PER_PAGE));
  const pagedHistoryGroups = historyGroups.slice(
    (historyPage - 1) * HISTORY_GROUPS_PER_PAGE,
    historyPage * HISTORY_GROUPS_PER_PAGE
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function runHistoryTerm(term: string) {
    const matches = searchStories(term, allStories);
    if (matches.length > 0) {
      dispatch({ type: "LOAD_STORY", story: matches[0] });
      storage.addSearchHistory(matches[0].title);
      setOpen(false);
      router.push("/");
    }
  }

  function openStory(storyId: string) {
    const story = storyById.get(storyId);
    if (!story) return;
    dispatch({ type: "LOAD_STORY", story });
    setOpen(false);
    router.push("/");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-modal-backdrop bg-[rgb(var(--shadow-color))]/50 backdrop-blur-sm"
                  onClick={() => setOpen(false)}
                />
                <motion.div
                  role="dialog"
                  aria-label="Playlists and search history"
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  className="fixed inset-y-0 left-0 z-drawer flex w-[88vw] max-w-sm flex-col border-r border-overlay/10 bg-canvas shadow-themed"
                >
                  <div className="flex items-center justify-between border-b border-overlay/10 px-5 py-4">
                    <span className="text-sm font-semibold text-ink">Menu</span>
                    <button
                      onClick={() => setOpen(false)}
                      aria-label="Close menu"
                      className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    {/* --- Playlists --- */}
                    <div className="mb-6">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                        <ListMusic className="h-3.5 w-3.5" /> Playlists
                      </div>

                      {currentUser && (
                        <form
                          className="mb-3 flex gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const trimmed = newPlaylistName.trim();
                            if (!trimmed) return;
                            devDataStore.createPlaylist(currentUser.id, trimmed);
                            setNewPlaylistName("");
                          }}
                        >
                          <input
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            placeholder="New playlist name"
                            className="min-w-0 flex-1 rounded-lg border border-overlay/15 bg-canvas-raised px-3 py-1.5 text-sm text-ink outline-none focus-visible:border-accent-medium"
                          />
                          <button
                            type="submit"
                            disabled={!newPlaylistName.trim()}
                            aria-label="Create playlist"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-canvas disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </form>
                      )}

                      {playlists.length === 0 ? (
                        <p className="text-sm text-ink-muted">No playlists yet — save a story to create one.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {playlists.map((playlist) => {
                            const expanded = expandedPlaylist === playlist.id;
                            const storyIds = devDataStore.listPlaylistContentIds(playlist.id);
                            return (
                              <div key={playlist.id} className="rounded-lg border border-overlay/10">
                                <div className="flex items-center gap-2 px-3 py-2">
                                  <button
                                    onClick={() => setExpandedPlaylist(expanded ? null : playlist.id)}
                                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                  >
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform ${expanded ? "" : "-rotate-90"}`}
                                    />
                                    <span className="truncate text-sm text-ink">{playlist.name}</span>
                                    <span className="shrink-0 text-xs text-ink-muted">({storyIds.length})</span>
                                  </button>
                                  <button
                                    onClick={() =>
                                      currentUser &&
                                      devDataStore.setPlaylistVisibility(playlist.id, currentUser.id, !playlist.isPublic)
                                    }
                                    aria-label={
                                      playlist.isPublic
                                        ? `Make ${playlist.name} private`
                                        : `Make ${playlist.name} public`
                                    }
                                    title={
                                      playlist.isPublic
                                        ? "Public — visible to anyone. Click to make private."
                                        : "Private — visible only to you. Click to make public."
                                    }
                                    className={`shrink-0 rounded-full p-1 transition-colors hover:bg-overlay/5 ${
                                      playlist.isPublic ? "text-accent-medium" : "text-ink-muted hover:text-ink"
                                    }`}
                                  >
                                    {playlist.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => currentUser && devDataStore.deletePlaylist(playlist.id, currentUser.id)}
                                    aria-label={`Delete playlist ${playlist.name}`}
                                    className="shrink-0 rounded-full p-1 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-accent-extreme"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {expanded && (
                                  <div className="space-y-1 border-t border-overlay/10 px-3 py-2">
                                    {storyIds.length === 0 ? (
                                      <p className="text-xs text-ink-muted">Nothing saved here yet.</p>
                                    ) : (
                                      storyIds.map((storyId) => {
                                        const story = storyById.get(storyId);
                                        return (
                                          <div key={storyId} className="flex items-center gap-2">
                                            <button
                                              onClick={() => openStory(storyId)}
                                              className="min-w-0 flex-1 truncate text-left text-xs text-ink-muted hover:text-ink"
                                            >
                                              {story?.title ?? storyId}
                                            </button>
                                            <button
                                              onClick={() => devDataStore.removeFromPlaylist(playlist.id, storyId)}
                                              aria-label="Remove from playlist"
                                              className="shrink-0 rounded-full p-1 text-ink-faint hover:text-accent-extreme"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* --- Search history --- */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                          <Clock className="h-3.5 w-3.5" /> Search history
                        </div>
                        {history.length > 0 &&
                          (confirmingClear ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  storage.clearSearchHistory();
                                  setHistory([]);
                                  setConfirmingClear(false);
                                }}
                                className="text-xs font-medium text-accent-extreme"
                              >
                                Confirm
                              </button>
                              <button onClick={() => setConfirmingClear(false)} className="text-xs text-ink-muted">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmingClear(true)}
                              className="text-xs text-ink-muted hover:text-accent-extreme"
                            >
                              Clear all
                            </button>
                          ))}
                      </div>

                      {history.length === 0 ? (
                        <p className="text-sm text-ink-muted">No searches yet.</p>
                      ) : (
                        <>
                          {/* Grouped Today/Yesterday/exact-date, same
                              convention as Past Test Attempts (see
                              lib/dateGroups.ts) — pagination here pages
                              through whole date groups, not individual
                              terms, so "Today" never gets split mid-page. */}
                          <div className="space-y-3">
                            {pagedHistoryGroups.map(([label, entries]) => (
                              <div key={label}>
                                <div className="mb-1 px-1 text-[11px] font-medium text-ink-faint">{label}</div>
                                <div className="space-y-1">
                                  {entries.map((entry) => (
                                    <div
                                      key={entry.term}
                                      className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-overlay/5"
                                    >
                                      <button
                                        onClick={() => runHistoryTerm(entry.term)}
                                        className="min-w-0 flex-1 truncate text-left text-sm text-ink-muted group-hover:text-ink"
                                      >
                                        {entry.term}
                                      </button>
                                      <button
                                        onClick={() => setHistory(storage.removeSearchHistoryItem(entry.term))}
                                        aria-label={`Delete "${entry.term}" from history`}
                                        className="shrink-0 rounded-full p-1 text-ink-faint opacity-0 transition-opacity hover:text-accent-extreme group-hover:opacity-100"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <Pagination page={historyPage} pageCount={historyPageCount} onChange={setHistoryPage} className="mt-2" />
                        </>
                      )}
                    </div>

                    {/* --- Danger zone: clear every uploaded story --- */}
                    <div className="border-t border-overlay/10 pt-3">
                      {confirmingClearStories ? (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-ink-muted">Delete all stories you've uploaded from this browser?</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => {
                                clearCustomStories();
                                setConfirmingClearStories(false);
                              }}
                              className="font-medium text-accent-extreme"
                            >
                              Confirm
                            </button>
                            <button onClick={() => setConfirmingClearStories(false)} className="text-ink-muted">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingClearStories(true)}
                          className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-accent-extreme"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Clear all uploaded stories
                        </button>
                      )}
                    </div>

                    {/* --- Danger zone: wipe all app data and start completely fresh --- */}
                    <div className="pt-3">
                      {confirmingResetAll ? (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-ink-muted">Erase ALL data and cache and start fresh? This signs you out and can't be undone.</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              disabled={resetting}
                              onClick={() => {
                                setResetting(true);
                                void resetAllAppData();
                              }}
                              className="font-medium text-accent-extreme disabled:opacity-50"
                            >
                              {resetting ? "Resetting…" : "Confirm"}
                            </button>
                            <button disabled={resetting} onClick={() => setConfirmingResetAll(false)} className="text-ink-muted">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingResetAll(true)}
                          className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-accent-extreme"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reset data
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
