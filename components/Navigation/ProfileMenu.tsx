"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, LayoutDashboard, History, BarChart3, Settings2, LogOut, UserCircle, ClipboardList } from "lucide-react";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser } from "@/lib/devData/useDevStore";

interface MenuItem {
  label: string;
  icon: React.ElementType;
  onSelect: () => void;
}

/**
 * Separated from TopNav.tsx (rather than inlined) because it owns its own
 * open/closed state and outside-click handling — logic that has nothing
 * to do with the navbar's layout and would otherwise clutter it.
 *
 * Route note: "Reading History" and "Analytics" both currently point at
 * `/results`, since that's the one page that already renders session
 * history and the analytics charts (see components/Analytics/Analytics.tsx)
 * — there's no separate dedicated route for either yet. This is a
 * pragmatic, additive choice: the menu structure the brief asks for
 * exists and is fully navigable today, and splitting `/results` into
 * distinct `/history` and `/analytics` routes later is a routing-only
 * change, not a data or component change.
 */
export function ProfileMenu() {
  const router = useRouter();
  const dispatch = useReadingDispatch();
  const currentUser = useCurrentUser();
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

  const items: MenuItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, onSelect: () => router.push("/dashboard") },
    ...(currentUser
      ? [{ label: "View profile", icon: UserCircle, onSelect: () => router.push(`/profile/${currentUser.id}`) }]
      : []),
    { label: "Reading History", icon: History, onSelect: () => router.push("/results") },
    { label: "Analytics", icon: BarChart3, onSelect: () => router.push("/results") },
    { label: "Past test attempts", icon: ClipboardList, onSelect: () => router.push("/history") },
    { label: "Settings", icon: Settings2, onSelect: () => dispatch({ type: "TOGGLE_SETTINGS_PANEL", open: true }) },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-overlay/15 bg-canvas-raised text-ink-muted transition-colors hover:border-overlay/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-medium"
      >
        <User className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-xl border border-overlay/10 bg-canvas-raised/95 py-1.5 shadow-themed backdrop-blur-xl"
          >
            {currentUser && (
              <div className="truncate border-b border-overlay/10 px-3.5 pb-2 pt-0.5 text-xs text-ink-muted">
                Signed in as <span className="text-ink">{currentUser.name}</span>
              </div>
            )}
            {items.map(({ label, icon: Icon, onSelect }) => (
              <button
                key={label}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-ink transition-colors hover:bg-overlay/5"
              >
                <Icon className="h-4 w-4 text-ink-muted" />
                {label}
              </button>
            ))}
            {currentUser && (
              <>
                <div className="my-1 h-px bg-overlay/10" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    devDataStore.logout();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-accent-extreme transition-colors hover:bg-overlay/5"
                >
                  <LogOut className="h-4 w-4" />
                  Log out (dev)
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
