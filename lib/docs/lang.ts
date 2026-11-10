"use client";
import { useSyncExternalStore } from "react";

/**
 * The language of the docs pages: English or Hindi. One tiny shared store (not a React context) so every part of
 * the page, including the breadcrumb below the footer line that sits outside the page shell, changes together.
 * The choice is remembered in this browser. The server and the first browser render always use English; the saved
 * choice is applied right after, so there is no hydration mismatch.
 */
export type DocsLang = "en" | "hi";
const KEY = "pacewise-docs-lang";
const EVENT = "pacewise-docs-lang";

function read(): DocsLang {
  try { return localStorage.getItem(KEY) === "hi" ? "hi" : "en"; } catch { return "en"; }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

export function setDocsLang(lang: DocsLang): void {
  try { localStorage.setItem(KEY, lang); } catch { /* storage blocked: the choice lasts until reload */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useDocsLang(): DocsLang {
  return useSyncExternalStore(subscribe, read, () => "en");
}
