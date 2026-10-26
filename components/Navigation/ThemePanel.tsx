"use client";

import React, { useEffect, useRef, useState } from "react";
import { Film, Plus, RotateCcw, Trash2 } from "lucide-react";
import { addBackground, deleteBackground, listBackgrounds, urlFor, type BackgroundItem } from "@/lib/landingMedia";
import { resetLandingAdjustments, useLandingTheme, type LandingTheme } from "@/lib/landingTheme";

const card = "relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl border p-2 text-left text-xs font-medium text-white transition-colors";

const SLIDERS: Array<{ key: "contrast" | "brightness" | "saturation" | "dim"; label: string; min: number; max: number; step: number }> = [
  { key: "contrast", label: "Contrast", min: 0.5, max: 1.5, step: 0.01 },
  { key: "brightness", label: "Brightness", min: 0.4, max: 1.6, step: 0.01 },
  { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.01 },
  { key: "dim", label: "Dim", min: 0, max: 0.8, step: 0.01 },
];

/** "Add theme": pick the landing-page background, upload your own photo/video, and tune it. */
export function ThemePanel() {
  const [theme, update] = useLandingTheme();
  const [items, setItems] = useState<BackgroundItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { void listBackgrounds().then(setItems); }, []);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const item = await addBackground(file);
      setItems((l) => [...l, item]);
      update({ mode: "media", mediaId: item.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(item: BackgroundItem) {
    await deleteBackground(item.id);
    setItems((l) => l.filter((x) => x.id !== item.id));
    if (theme.mediaId === item.id) update({ mode: "dots", mediaId: undefined });
  }

  const ring = (on: boolean) => (on ? "border-accent-medium ring-2 ring-accent-medium/40" : "border-overlay/15 hover:border-overlay/40");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => update({ mode: "dots" })} aria-pressed={theme.mode === "dots"} className={`${card} bg-[#0c0d10] ${ring(theme.mode === "dots")}`}>
          <span className="relative z-10">Dots (default)</span>
        </button>
        <button
          type="button"
          onClick={() => update({ mode: "grainient" })}
          aria-pressed={theme.mode === "grainient"}
          className={`${card} ${ring(theme.mode === "grainient")}`}
          style={{ background: "linear-gradient(55deg,#120f17,#2a0f0a 30%,#9a3412 60%,#f97316 85%,#fed7aa)" }}
        >
          <span className="relative z-10 drop-shadow">Grainient</span>
        </button>

        {items.map((item) => {
          const on = theme.mode === "media" && theme.mediaId === item.id;
          return (
            <div key={item.id} className="group relative">
              <button type="button" onClick={() => update({ mode: "media", mediaId: item.id })} aria-pressed={on} className={`${card} w-full bg-overlay/10 ${ring(on)}`}>
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlFor(item)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <video src={urlFor(item)} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="relative z-10 flex items-center gap-1 truncate">{item.kind === "video" && <Film className="h-3 w-3 shrink-0" />}<span className="truncate">{item.name}</span></span>
              </button>
              <button
                type="button"
                onClick={() => void remove(item)}
                aria-label={`Delete ${item.name}`}
                className="absolute right-2 top-2 z-20 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-overlay/30 text-sm text-ink-muted transition-colors hover:border-overlay/60 hover:text-ink disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
          {busy ? "Adding…" : "Upload photo or video"}
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,video/ogg" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      </div>
      {error && <p className="text-sm text-accent-extreme">{error}</p>}

      <div className="space-y-4">
        {SLIDERS.map((s) => (
          <label key={s.key} className="block">
            <span className="flex items-center justify-between text-sm text-ink">
              {s.label}
              <span className="tabular-nums text-ink-muted">{(theme[s.key as keyof LandingTheme] as number).toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={theme[s.key as keyof LandingTheme] as number}
              onChange={(e) => update({ [s.key]: Number(e.target.value) })}
              className="mt-1 w-full accent-accent-medium"
            />
          </label>
        ))}
        <button type="button" onClick={resetLandingAdjustments} className="flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink">
          <RotateCcw className="h-3.5 w-3.5" /> Reset adjustments
        </button>
      </div>
    </div>
  );
}
