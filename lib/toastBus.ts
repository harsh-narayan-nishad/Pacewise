"use client";

import { useSyncExternalStore } from "react";

/**
 * Minimal pub/sub toast queue — the app had no toast/snackbar system
 * before this phase, and Share/Comment both need brief success/error
 * feedback (per the brief's "show success feedback" / "handle errors").
 * Rather than inventing a per-component inline message or pulling in a
 * toast library, this is a tiny shared bus any component can push to via
 * `pushToast(...)`, rendered once by `ToastHost` (mounted in app/layout.tsx
 * next to the other app-wide singletons). Same subscribe/emit shape as
 * `lib/devData/store.ts` for consistency, but intentionally a separate,
 * unrelated module — toasts are ephemeral UI feedback, not development
 * data, so they don't belong in the dev data store.
 */
export interface Toast {
  id: string;
  kind: "success" | "error";
  message: string;
}

type Listener = () => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function emit() {
  listeners.forEach((l) => l());
}

export function pushToast(kind: Toast["kind"], message: string): void {
  counter += 1;
  const toast: Toast = { id: `toast-${counter}`, kind, message };
  toasts = [...toasts, toast];
  emit();
  window.setTimeout(() => dismissToast(toast.id), 3200);
}

export function dismissToast(id: string): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Toast[] {
  return toasts;
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}
