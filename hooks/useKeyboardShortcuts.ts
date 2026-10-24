"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onPlayPause?: () => void;
  onSpeedUp?: () => void;
  onSpeedDown?: () => void;
  onFullscreen?: () => void;
  onRestart?: () => void;
  onEscape?: () => void;
}

/**
 * Centralizes all keybindings in one place instead of scattering
 * addEventListener calls across components — makes the full shortcut
 * surface auditable at a glance and easy to remap.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handlers.onPlayPause?.();
          break;
        case "ArrowUp":
          e.preventDefault();
          handlers.onSpeedUp?.();
          break;
        case "ArrowDown":
          e.preventDefault();
          handlers.onSpeedDown?.();
          break;
        case "KeyF":
          handlers.onFullscreen?.();
          break;
        case "KeyR":
          handlers.onRestart?.();
          break;
        case "Escape":
          handlers.onEscape?.();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers, enabled]);
}
