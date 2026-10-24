"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { dismissToast, useToasts } from "@/lib/toastBus";

/**
 * Renders the shared toast queue (lib/toastBus.ts) fixed to the bottom of
 * the viewport. Mounted once in app/layout.tsx. Sits at `z-toast`, the
 * top of the app's stacking hierarchy (see tailwind.config.ts), since a
 * confirmation/error toast should always be visible above any open modal,
 * drawer, or overlay that triggered it (e.g. the Share modal's own
 * success toast must show up above the Share modal itself).
 */
export function ToastHost() {
  const toasts = useToasts();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-toast flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border border-overlay/10 bg-canvas-raised/95 px-4 py-2.5 text-sm text-ink shadow-themed backdrop-blur-xl"
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-medium" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-accent-extreme" />
            )}
            <span className="min-w-0 flex-1">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded-full p-0.5 text-ink-faint hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
