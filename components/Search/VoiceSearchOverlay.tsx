"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X } from "lucide-react";

const Pulse = styled.div`
  position: relative;
  width: 160px;
  height: 160px;
  display: grid;
  place-items: center;

  .ring {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    border: 2px solid rgb(var(--overlay) / 0.25);
    animation: ring-pulse 2.2s ease-out infinite;
  }
  .ring:nth-child(2) {
    animation-delay: 0.7s;
  }
  .ring:nth-child(3) {
    animation-delay: 1.4s;
  }
  .core {
    position: relative;
    z-index: 1;
    width: 96px;
    height: 96px;
    border-radius: 9999px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #9147ff, #ff4141);
    box-shadow: 0 10px 40px rgba(145, 71, 255, 0.35);
  }

  @keyframes ring-pulse {
    0% {
      transform: scale(0.8);
      opacity: 0.6;
    }
    100% {
      transform: scale(1.8);
      opacity: 0;
    }
  }
`;

interface VoiceSearchOverlayProps {
  open: boolean;
  query: string;
  supported: boolean;
  onClose: () => void;
}

/**
 * The brief asks for voice search specifically to open as its own
 * 100vw x 100vh experience, separate from the compact inline search bar
 * it's triggered from (either the landing page's or the navbar's — see
 * SearchBar.tsx). Rendered through a React portal straight onto
 * `document.body` rather than in place: the navbar applies
 * `backdrop-blur` (a CSS `filter`), and a `filter` on an ancestor creates
 * a new containing block for `position: fixed` descendants in modern
 * browsers — without the portal, an overlay triggered from the navbar's
 * search bar would be clipped to the navbar's own bounds instead of
 * actually covering the viewport.
 */
export function VoiceSearchOverlay({ open, query, supported, onClose }: VoiceSearchOverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-overlay flex h-[100vh] w-[100vw] flex-col items-center justify-center bg-canvas/97 px-6 backdrop-blur-2xl"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close voice search"
            className="absolute right-5 top-5 rounded-full p-2 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>

          {supported ? (
            <>
              <Pulse>
                <div className="ring" />
                <div className="ring" />
                <div className="ring" />
                <div className="core">
                  <Mic className="h-9 w-9 text-white" />
                </div>
              </Pulse>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 max-w-md text-center font-display text-2xl text-ink"
              >
                {query ? `"${query}"` : "Listening..."}
              </motion.p>
              <p className="mt-3 text-sm text-ink-muted">Speak the story you're looking for</p>
            </>
          ) : (
            <p className="max-w-sm text-center text-sm text-ink-muted">
              Voice search isn't supported in this browser. Try typing instead, or use Chrome/Edge.
            </p>
          )}

          <button
            onClick={onClose}
            className="mt-10 rounded-full border border-overlay/15 px-5 py-2 text-sm text-ink-muted transition-colors hover:border-overlay/30 hover:text-ink"
          >
            Tap to cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
