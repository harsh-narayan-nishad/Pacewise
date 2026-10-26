"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Landing-page background theme: which background, and how it is adjusted. Stored per browser. */
export type LandingMode = "dots" | "grainient" | "media";

export interface LandingTheme {
  mode: LandingMode;
  /** Id of an uploaded photo/video (see lib/landingMedia.ts) when mode is "media". */
  mediaId?: string;
  contrast: number; // 0.5 – 1.5
  brightness: number; // 0.4 – 1.6
  saturation: number; // 0 – 2
  dim: number; // 0 – 0.8 black scrim, keeps text readable
}

export const DEFAULT_LANDING_THEME: LandingTheme = { mode: "dots", contrast: 1, brightness: 1, saturation: 1, dim: 0 };

const KEY = "speed-reader.landing-theme.v1";
const listeners = new Set<() => void>();
let cache: LandingTheme | null = null;

const num = (v: unknown, min: number, max: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

function read(): LandingTheme {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LANDING_THEME;
    const p = JSON.parse(raw) as Partial<LandingTheme>;
    const mode: LandingMode = p.mode === "grainient" || p.mode === "media" ? p.mode : "dots";
    return {
      mode: mode === "media" && typeof p.mediaId !== "string" ? "dots" : mode,
      mediaId: typeof p.mediaId === "string" ? p.mediaId : undefined,
      contrast: num(p.contrast, 0.5, 1.5, 1),
      brightness: num(p.brightness, 0.4, 1.6, 1),
      saturation: num(p.saturation, 0, 2, 1),
      dim: num(p.dim, 0, 0.8, 0),
    };
  } catch {
    return DEFAULT_LANDING_THEME;
  }
}

function snapshot(): LandingTheme {
  if (!cache) cache = read();
  return cache;
}

export function setLandingTheme(patch: Partial<LandingTheme>): void {
  cache = { ...snapshot(), ...patch };
  try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}

export function resetLandingAdjustments(): void {
  setLandingTheme({ contrast: 1, brightness: 1, saturation: 1, dim: 0 });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; cb(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

export function useLandingTheme(): [LandingTheme, (patch: Partial<LandingTheme>) => void] {
  const theme = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_LANDING_THEME);
  const update = useCallback((patch: Partial<LandingTheme>) => setLandingTheme(patch), []);
  return [theme, update];
}

/** CSS filter for the adjustments, or undefined when they are all neutral. */
export function themeFilter(t: LandingTheme): string | undefined {
  if (t.contrast === 1 && t.brightness === 1 && t.saturation === 1) return undefined;
  return `contrast(${t.contrast}) brightness(${t.brightness}) saturate(${t.saturation})`;
}
