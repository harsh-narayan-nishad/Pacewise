"use client";

import React, { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { fileToThumbnail, safeThumbnail } from "@/lib/thumbnail";

interface Props {
  value?: string;
  onChange: (thumbnail: string | undefined) => void;
}

/** Choose / replace / remove the story's thumbnail. With none, the card gets a generated cover. */
export function ThumbnailPicker({ value, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = safeThumbnail(value);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await fileToThumbnail(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that image.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs text-ink-muted">Thumbnail</label>
      <div className="flex items-center gap-3 rounded-lg border border-overlay/15 bg-canvas p-2">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-overlay/5 text-ink-faint">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Thumbnail preview" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs text-ink-muted">
          {shown ? "Custom thumbnail" : "Automatic cover (generated from the title)"}
          {error && <div className="mt-1 text-accent-extreme">{error}</div>}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-full border border-overlay/15 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-overlay/30 disabled:opacity-40">
          {busy ? "Working…" : shown ? "Change" : "Choose image"}
        </button>
        {shown && (
          <button type="button" onClick={() => onChange(undefined)} aria-label="Remove thumbnail" className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
