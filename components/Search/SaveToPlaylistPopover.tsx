"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ListPlus, Plus } from "lucide-react";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";

interface SaveToPlaylistPopoverProps {
  storyId: string;
  /** Whether this story is already in at least one playlist — drives the
   *  button's own filled/outline state in the parent card/actions bar. */
  onChange?: (inAnyPlaylist: boolean) => void;
}

/**
 * The "Add to playlist" action's own dropdown: lets content be filed into
 * one or more of the *current dev user's* named playlists (the brief's
 * "Programming, Mathematics, Physics, JavaScript, Personal Learning"
 * examples are just playlist names a user picks — there's no fixed
 * taxonomy), or a brand new playlist created inline.
 *
 * Playlists and their content relationships live in the centralized
 * `devDataStore` (lib/devData/store.ts) — not localStorage — per this
 * phase's "no browser-only persistence for relationship data" rule, and
 * are scoped per userId now that the app has real (development) accounts,
 * where the old localStorage version was anonymous/browser-wide. Toggling
 * a playlist that already contains the content removes it instead of
 * erroring, and `addToPlaylist` is itself dedup-safe, so there's no way to
 * end up with a duplicate save.
 *
 * Same dropdown shell/positioning convention as ProfileMenu.tsx, anchored
 * under its own trigger button.
 */
export function SaveToPlaylistPopover({ storyId, onChange }: SaveToPlaylistPopoverProps) {
  const currentUser = useCurrentUser();
  const version = useDevStoreVersion();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const userId = currentUser?.id ?? "";
  const playlists = currentUser ? devDataStore.listPlaylists(userId) : [];
  const containingSet = currentUser ? devDataStore.playlistsContaining(userId, storyId) : new Set<string>();
  const saved = containingSet.size > 0;

  useEffect(() => {
    onChange?.(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, storyId, version]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!currentUser) return null;

  function toggle(playlistId: string) {
    if (containingSet.has(playlistId)) {
      devDataStore.removeFromPlaylist(playlistId, storyId);
    } else {
      devDataStore.addToPlaylist(playlistId, storyId, userId);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={saved ? "Saved to a playlist" : "Add to playlist"}
        title={saved ? "Saved to a playlist" : "Add to playlist"}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          saved ? "bg-ink text-canvas" : "text-ink-muted hover:bg-overlay/5 hover:text-ink"
        }`}
      >
        <ListPlus className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute right-0 top-10 z-50 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-overlay/10 bg-canvas-raised/95 py-1.5 shadow-themed backdrop-blur-xl"
          >
            <div className="px-3.5 pb-1 pt-0.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Add to playlist
            </div>

            <div className="max-h-48 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="px-3.5 py-2 text-sm text-ink-muted">No playlists yet.</p>
              ) : (
                playlists.map((playlist) => {
                  const inIt = containingSet.has(playlist.id);
                  return (
                    <button
                      key={playlist.id}
                      role="menuitemcheckbox"
                      aria-checked={inIt}
                      onClick={() => toggle(playlist.id)}
                      className="flex w-full items-center justify-between gap-2.5 px-3.5 py-2 text-left text-sm text-ink transition-colors hover:bg-overlay/5"
                    >
                      <span className="truncate">{playlist.name}</span>
                      {inIt && <Check className="h-3.5 w-3.5 shrink-0 text-accent-medium" />}
                    </button>
                  );
                })
              )}
            </div>

            <form
              className="mt-1 flex gap-1.5 border-t border-overlay/10 px-2.5 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newName.trim();
                if (!trimmed) return;
                const created = devDataStore.createPlaylist(userId, trimmed);
                if (created) devDataStore.addToPlaylist(created.id, storyId, userId);
                setNewName("");
              }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New playlist"
                className="min-w-0 flex-1 rounded-lg border border-overlay/15 bg-canvas px-2.5 py-1 text-sm text-ink outline-none focus-visible:border-accent-medium"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                aria-label="Create and save"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink text-canvas disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
