"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageCircle, Reply, Send, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";
import { DevComment } from "@/lib/devData/types";

interface CommentPanelProps {
  contentId: string;
}

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** One comment row — like/dislike, reply, delete (own comment only), and,
 *  for a top-level comment, its reply thread underneath. Used for both
 *  top-level comments and replies (replies just render without their own
 *  nested replies row, since the store normalizes a reply-to-a-reply onto
 *  the original top-level comment — see DevComment.parentId). */
function CommentRow({
  comment,
  currentUserId,
  depth,
  onReply,
}: {
  comment: DevComment;
  currentUserId: string;
  depth: 0 | 1;
  onReply: (comment: DevComment) => void;
}) {
  const author = devDataStore.findUserById(comment.userId);
  const isOwn = comment.userId === currentUserId;
  const myReaction = devDataStore.getCommentReaction(comment.id, currentUserId);
  const counts = devDataStore.commentReactionCounts(comment.id);

  return (
    <div className={`group ${depth === 1 ? "ml-5 border-l border-overlay/10 pl-3" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink">{author?.name ?? "Unknown user"}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-faint">{formatWhen(comment.createdAt)}</span>
          {isOwn && (
            <button
              onClick={() => devDataStore.deleteComment(comment.id, currentUserId)}
              aria-label="Delete comment"
              className="rounded-full p-0.5 text-ink-faint opacity-0 transition-opacity hover:text-accent-extreme group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-0.5 text-sm text-ink-muted">{comment.text}</p>
      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={() => devDataStore.setCommentReaction(comment.id, currentUserId, "like")}
          aria-pressed={myReaction === "like"}
          aria-label="Like comment"
          className={`flex items-center gap-1 rounded-full px-1 py-0.5 text-xs transition-colors ${
            myReaction === "like" ? "text-accent-medium" : "text-ink-faint hover:text-ink"
          }`}
        >
          <ThumbsUp className="h-3 w-3" fill={myReaction === "like" ? "currentColor" : "none"} />
          {counts.like > 0 && counts.like}
        </button>
        <button
          onClick={() => devDataStore.setCommentReaction(comment.id, currentUserId, "dislike")}
          aria-pressed={myReaction === "dislike"}
          aria-label="Dislike comment"
          className={`flex items-center gap-1 rounded-full px-1 py-0.5 text-xs transition-colors ${
            myReaction === "dislike" ? "text-accent-extreme" : "text-ink-faint hover:text-ink"
          }`}
        >
          <ThumbsDown className="h-3 w-3" fill={myReaction === "dislike" ? "currentColor" : "none"} />
          {counts.dislike > 0 && counts.dislike}
        </button>
        {depth === 0 && (
          <button
            onClick={() => onReply(comment)}
            aria-label="Reply to comment"
            className="flex items-center gap-1 rounded-full px-1 py-0.5 text-xs text-ink-faint transition-colors hover:text-ink"
          >
            <Reply className="h-3 w-3" /> Reply
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The Comment action: a popover (same shell convention as every other
 * dropdown in the app) holding the existing comment list plus a composer.
 * Comments live in the centralized `devDataStore`, not component state —
 * so the comment count shown on the trigger button, this panel, and any
 * other place the same contentId is rendered (e.g. the content reached
 * via a share notification) all read the exact same data.
 *
 * Threaded like YouTube: each top-level comment can be liked/disliked and
 * replied to, and its replies render indented underneath it, each
 * independently likeable/dislikeable and themselves re-commentable (a
 * reply to a reply is folded onto the same thread — see
 * DevComment.parentId / devDataStore.createComment).
 */
export function CommentPanel({ contentId }: CommentPanelProps) {
  const currentUser = useCurrentUser();
  useDevStoreVersion();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<DevComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const topLevel = devDataStore.listComments(contentId).filter((c) => !c.parentId);
  const totalCount = devDataStore.commentCount(contentId);

  function startReply(comment: DevComment) {
    setReplyTo(comment);
    setError(null);
    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // `submitting` is the guard against double-submit (a second click
    // while the first request is "in flight") and an empty/whitespace-only
    // comment is rejected before it ever reaches the store.
    if (submitting || !currentUser) return;
    if (!text.trim()) {
      setError("Comment can't be empty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    window.setTimeout(() => {
      const result = devDataStore.createComment({
        contentId,
        userId: currentUser.id,
        text,
        parentId: replyTo?.id,
      });
      setSubmitting(false);
      if (result.ok) {
        setText("");
        setReplyTo(null);
      } else {
        setError(result.error);
      }
    }, 150);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Comments"
        title="Comments"
        className="flex h-8 items-center gap-1.5 rounded-full px-2 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"
      >
        <MessageCircle className="h-4 w-4" />
        {totalCount > 0 && <span className="text-xs">{totalCount}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Comments"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute right-0 top-10 z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-overlay/10 bg-canvas-raised/95 shadow-themed backdrop-blur-xl sm:w-80"
          >
            <div className="flex items-center justify-between border-b border-overlay/10 px-3.5 py-2.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Comments{totalCount > 0 ? ` (${totalCount})` : ""}
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-ink-faint hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto px-3.5 py-2">
              {topLevel.length === 0 ? (
                <p className="py-3 text-center text-sm text-ink-muted">No comments yet — be the first.</p>
              ) : (
                <div className="space-y-3">
                  {topLevel.map((comment) => {
                    const replies = devDataStore.listReplies(comment.id);
                    return (
                      <div key={comment.id} className="space-y-2.5">
                        <CommentRow comment={comment} currentUserId={currentUser.id} depth={0} onReply={startReply} />
                        {replies.map((reply) => (
                          <CommentRow key={reply.id} comment={reply} currentUserId={currentUser.id} depth={1} onReply={startReply} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-overlay/10 p-2.5">
              {error && <p className="mb-1.5 text-xs text-accent-extreme">{error}</p>}
              {replyTo && (
                <div className="mb-1.5 flex items-center justify-between rounded-md bg-overlay/5 px-2 py-1 text-xs text-ink-muted">
                  <span className="truncate">
                    Replying to {devDataStore.findUserById(replyTo.userId)?.name ?? "comment"}
                  </span>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="shrink-0 text-ink-faint hover:text-ink">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
                  maxLength={500}
                  className="min-w-0 flex-1 rounded-lg border border-overlay/15 bg-canvas px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:border-accent-medium"
                />
                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  aria-label={replyTo ? "Post reply" : "Post comment"}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-canvas disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
