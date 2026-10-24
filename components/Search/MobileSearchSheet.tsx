"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { SearchBar } from "@/components/Search/SearchBar";

/**
 * The navbar's compact `<SearchBar size="sm">` (see TopNav.tsx) genuinely
 * doesn't fit next to the hamburger + logo + theme/fullscreen/settings/
 * profile icon cluster at phone widths — there just isn't 220px of spare
 * row left once all of that chrome is laid out. Rather than shrinking the
 * navbar's existing icons or hiding any of them (which the brief asks not
 * to touch), this gives small screens a dedicated search trigger instead:
 * a single icon button that opens the same SearchBar component — not a
 * reimplementation of it — full-screen, exactly the way voice search
 * already does (see VoiceSearchOverlay). This is the "navbar search must
 * remain usable on smaller screens" requirement, met by presentation, not
 * by cramming the inline bar into a row that can't hold it.
 */
export function MobileSearchSheet() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink sm:hidden"
      >
        <Search className="h-4 w-4" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-overlay flex h-[100vh] w-[100vw] flex-col items-center justify-center gap-4 bg-canvas/97 px-6 backdrop-blur-xl"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setOpen(false);
                }}
              >
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close search"
                  className="absolute right-5 top-5 rounded-full p-2 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
                <SearchBar size="default" />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
