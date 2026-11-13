"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavLoader } from "@/contexts/NavLoaderContext";
import { startSwitchLoader } from "@/lib/switchLoader";
import { motion, AnimatePresence } from "framer-motion";
import { resetAllAppData } from "@/lib/resetApp";
import { ChevronDown, ChevronRight, Globe, Lock, LogOut, Menu, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { storage, SearchHistoryEntry } from "@/lib/storage";
import { getAllStories, searchStories, clearCustomStories } from "@/lib/storyLibrary";
import { groupByDateBucket } from "@/lib/dateGroups";
import { ThemePanel } from "@/components/Navigation/ThemePanel";
import { Pagination } from "@/components/ui/Pagination";
import { devDataStore } from "@/lib/devData/store";
import { useAuth } from "@/lib/api/AuthContext";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";

/**
 * The right-side drawer the brief calls the "hamburger menu" — placed at
 * the rightmost side of the navbar (see TopNav.tsx), and, once built, its
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
/** A large display-type row with a divider and chevron, like the Samsung mobile menu. */
function BigRow({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between py-3 text-left"
    >
      <span className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-4xl">{label}</span>
      <span className="flex items-center gap-4">
        <span aria-hidden className="h-9 w-px bg-overlay/15" />
        <ChevronRight className={`h-5 w-5 text-ink transition-transform ${open ? "rotate-90" : ""}`} />
      </span>
    </button>
  );
}

export function HamburgerMenu() {
  const nav = useNavLoader();
  const dispatch = useReadingDispatch();
  const currentUser = useCurrentUser();
  const { logout: signOut } = useAuth();
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
  // Samsung-style menu: two big accordion rows (Playlists / Search history) and a search pill.
  const [section, setSection] = useState<"playlists" | "history" | "theme" | null>(null);
  const [menuQuery, setMenuQuery] = useState("");

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
      startSwitchLoader("reading", "/");
      nav.push("/");
    }
  }

  function openStory(storyId: string) {
    const story = storyById.get(storyId);
    if (!story) return;
    dispatch({ type: "LOAD_STORY", story });
    setOpen(false);
    startSwitchLoader("reading", "/");
    nav.push("/");
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
                  className="fixed inset-0 z-modal-backdrop bg-[rgb(var(--shadow-color))]/50"
                  onClick={() => setOpen(false)}
                />
                <motion.div
                  role="dialog"
                  aria-label="Playlists and search history"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  className="fixed inset-y-0 right-0 z-drawer flex w-[92vw] max-w-md flex-col border-l border-overlay/10 bg-canvas shadow-themed"
                >
                  <div className="flex items-center gap-4 px-6 pb-2 pt-5">
                    <form
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-overlay/[0.06] px-4 py-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const term = menuQuery.trim();
                        if (term) runHistoryTerm(term);
                      }}
                    >
                      <Search className="h-4 w-4 shrink-0 text-ink-muted" />
                      <input
                        value={menuQuery}
                        onChange={(e) => setMenuQuery(e.target.value)}
                        placeholder="Search stories"
                        aria-label="Search stories"
                        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
                      />
                    </form>
                    <button
                      onClick={() => setOpen(false)}
                      aria-label="Close menu"
                      className="shrink-0 rounded-full p-2 text-ink transition-colors hover:bg-overlay/10"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Your library</div>
                    {/* --- Playlists --- */}
                    <BigRow label="Playlists" open={section === "playlists"} onToggle={() => setSection(section === "playlists" ? null : "playlists")} />
                    <div className={section === "playlists" ? "mb-4 mt-2" : "hidden"}>

                      {currentUser && (
                        <form
                          className="mb-4 flex gap-2"
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
                            aria-label="New playlist name"
                            maxLength={60}
                            className="h-12 min-w-0 flex-1 rounded-full border border-overlay/15 bg-transparent px-5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent-medium"
                          />
                          <button
                            type="submit"
                            disabled={!newPlaylistName.trim()}
                            className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-medium text-canvas transition-colors hover:bg-ink/90 disabled:pointer-events-none disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" /> Create
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

                    {/* --- Past test attempts (moved here from the story page) --- */}
                    <BigRow label="Past test attempts" open={false} onToggle={() => { setOpen(false); nav.push("/history"); }} />

                    {/* --- Add theme: landing-page background --- */}
                    <BigRow label="Add theme" open={section === "theme"} onToggle={() => setSection(section === "theme" ? null : "theme")} />
                    <div className={section === "theme" ? "mb-4 mt-2" : "hidden"}>
                      {section === "theme" && <ThemePanel />}
                    </div>

                    {/* --- Search history --- */}
                    <BigRow label="Search history" open={section === "history"} onToggle={() => setSection(section === "history" ? null : "history")} />
                    <div className={section === "history" ? "mb-4 mt-2" : "hidden"}>
                      <div className="mb-2 flex items-center justify-end">
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
                    <div className="mt-6 border-t border-overlay/10 pt-5">
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
                          className="flex items-center gap-2 text-base text-ink transition-colors hover:text-accent-extreme"
                        >
                          <Trash2 className="h-4 w-4" /> Clear all uploaded stories
                        </button>
                      )}
                    </div>

                    {/* --- Danger zone: wipe all app data and start completely fresh --- */}
                    <div className="pt-4">
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
                          className="flex items-center gap-2 text-base text-ink transition-colors hover:text-accent-extreme"
                        >
                          <RotateCcw className="h-4 w-4" /> Reset everything (clear all data &amp; cache)
                        </button>
                      )}
                    </div>
                    {currentUser && (
                      <div className="mt-6 border-t border-overlay/10 pt-5 text-base text-ink-muted">Signed in as <span className="text-ink">{currentUser.name}</span></div>
                    )}
                    {currentUser && (
                      <button
                        onClick={() => { setOpen(false); void signOut(); }}
                        className="mt-4 flex items-center gap-2 text-base text-accent-extreme transition-opacity hover:opacity-80"
                      >
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    )}
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
