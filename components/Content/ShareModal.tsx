"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Share2, Trash2, X } from "lucide-react";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";
import { pushToast } from "@/lib/toastBus";

interface ShareModalProps {
  contentId: string;
}

/**
 * The Share action's recipient picker — same dropdown shell/positioning
 * convention as ProfileMenu/SaveToPlaylistPopover (the app's existing
 * "popover anchored to its own trigger button" pattern), not a new modal
 * design.
 *
 * Flow matches the brief's example exactly: open → select a recipient →
 * confirm with an explicit "Share" button (not a single click per row, so
 * an accidental tap on a name can't submit a share) → devDataStore creates
 * the DevShare + DevNotification together → toast feedback → the list of
 * people this content has already been shared with (by the current user)
 * is shown below with its own delete button, satisfying "allow deletion
 * of the share through the website."
 */
export function ShareModal({ contentId }: ShareModalProps) {
  const currentUser = useCurrentUser();
  useDevStoreVersion();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const recipients = devDataStore.listUsers().filter((u) => u.id !== currentUser.id);
  const sentShares = devDataStore.listShares({ senderId: currentUser.id, contentId });

  function handleConfirm() {
    if (!selectedId || submitting || !currentUser) return;
    setSubmitting(true);
    // Small artificial delay so the loading state (spinner on the Share
    // button) is actually visible, same convention as DevLoginGate's
    // submit — there's no real network latency to wait on here.
    window.setTimeout(() => {
      const result = devDataStore.createShare({
        senderId: currentUser.id,
        receiverId: selectedId,
        contentId,
      });
      setSubmitting(false);
      if (result.ok) {
        const recipient = devDataStore.findUserById(selectedId);
        pushToast("success", `Shared with ${recipient?.name ?? "recipient"}.`);
        setSelectedId(null);
      } else {
        pushToast("error", result.error);
      }
    }, 200);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Share"
        title="Share"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"
      >
        <Share2 className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Share this content"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute right-0 top-10 z-50 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-overlay/10 bg-canvas-raised/95 shadow-themed backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-overlay/10 px-3.5 py-2.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Share with</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-ink-faint hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto py-1">
              {recipients.map((user) => (
                <button
                  key={user.id}
                  role="radio"
                  aria-checked={selectedId === user.id}
                  onClick={() => setSelectedId(user.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors hover:bg-overlay/5 ${
                    selectedId === user.id ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  <span className="truncate">{user.name}</span>
                  {selectedId === user.id && <Check className="h-3.5 w-3.5 shrink-0 text-accent-medium" />}
                </button>
              ))}
            </div>

            <div className="border-t border-overlay/10 p-2.5">
              <button
                onClick={handleConfirm}
                disabled={!selectedId || submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2 text-sm font-medium text-canvas transition-opacity disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                {submitting ? "Sharing…" : "Share"}
              </button>
            </div>

            {sentShares.length > 0 && (
              <div className="border-t border-overlay/10 px-3.5 py-2.5">
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Already shared with
                </div>
                <div className="space-y-1">
                  {sentShares.map((share) => {
                    const recipient = devDataStore.findUserById(share.receiverId);
                    return (
                      <div key={share.id} className="flex items-center justify-between gap-2 text-sm text-ink-muted">
                        <span className="truncate">{recipient?.name ?? share.receiverId}</span>
                        <button
                          onClick={() => {
                            devDataStore.deleteShare(share.id);
                            pushToast("success", "Share removed.");
                          }}
                          aria-label={`Remove share with ${recipient?.name ?? share.receiverId}`}
                          className="shrink-0 rounded-full p-1 text-ink-faint hover:text-accent-extreme"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
