"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Heart, MessageCircle, Share2, Trash2, UserPlus } from "lucide-react";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { getStoryById } from "@/lib/storyLibrary";
import { storage } from "@/lib/storage";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser, useDevStoreVersion } from "@/lib/devData/useDevStore";
import { DevNotification } from "@/lib/devData/types";

const TYPE_ICON: Record<DevNotification["type"], React.ElementType> = {
  share: Share2,
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
};

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The notification system (Phase 6/7 of the social-features brief) added
 * to the existing navbar — same dropdown shell/positioning convention as
 * ProfileMenu, not a redesign of TopNav. Shows an unread badge, and
 * clicking a notification: marks it read, then navigates — to the exact
 * content via its stable contentId for share/like/comment (reusing the
 * existing `LOAD_STORY` dispatch + "/" route, the app's one content
 * page/route — see Dashboard.tsx), or to the sender's profile for a
 * "follow" notification, which has no content of its own. Covers every
 * major social event (share, like, comment, follow), not just share, the
 * same way a real social app's activity feed would.
 */
export function NotificationBell() {
  const router = useRouter();
  const dispatch = useReadingDispatch();
  const currentUser = useCurrentUser();
  useDevStoreVersion();
  const [open, setOpen] = useState(false);
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

  const notifications = devDataStore.listNotifications(currentUser.id);
  const unread = devDataStore.unreadCount(currentUser.id);

  function openNotification(n: DevNotification) {
    devDataStore.markNotificationRead(n.id);
    setOpen(false);

    if (n.type === "follow") {
      router.push(`/profile/${n.senderId}`);
      return;
    }
    if (!n.contentId) return;
    const story = getStoryById(n.contentId);
    if (story) {
      dispatch({ type: "LOAD_STORY", story });
      storage.addSearchHistory(story.title);
    }
    router.push("/");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-overlay/[0.08] text-ink-muted transition-colors hover:bg-overlay/[0.14] hover:text-ink active:scale-95"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-extreme px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute right-0 top-11 z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-overlay/10 bg-canvas-raised/95 shadow-themed backdrop-blur-xl sm:w-80"
          >
            <div className="flex items-center justify-between border-b border-overlay/10 px-3.5 py-2.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={() => devDataStore.markAllNotificationsRead(currentUser.id)}
                  className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-sm text-ink-muted">No notifications yet.</p>
              ) : (
                notifications.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Bell;
                  return (
                    <div
                      key={n.id}
                      className={`group flex items-start gap-2 border-b border-overlay/5 px-3.5 py-2.5 last:border-b-0 ${
                        n.read ? "" : "bg-overlay/5"
                      }`}
                    >
                      <button
                        onClick={() => openNotification(n)}
                        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            n.read ? "bg-overlay/5 text-ink-faint" : "bg-accent-medium/10 text-accent-medium"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className={`text-sm ${n.read ? "text-ink-muted" : "text-ink"}`}>{n.message}</p>
                          <span className="text-xs text-ink-faint">{formatWhen(n.createdAt)}</span>
                        </span>
                      </button>
                      <button
                        onClick={() => devDataStore.deleteNotification(n.id)}
                        aria-label="Delete notification"
                        className="shrink-0 rounded-full p-1 text-ink-faint opacity-0 transition-opacity hover:text-accent-extreme group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
