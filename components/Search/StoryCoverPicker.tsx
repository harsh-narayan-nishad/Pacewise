"use client";

import React, { useRef, useState } from "react";
import { ImagePlus, Play, Trash2, Video } from "lucide-react";
import { fileToThumbnail, safeThumbnail } from "@/lib/thumbnail";
import { saveThumbnailVideo, deleteThumbnailVideo } from "@/lib/thumbnailVideo";

interface Props {
  photo?: string;
  onPhoto: (photo: string | undefined) => void;
  /** Reference id of the stored hover video (see lib/thumbnailVideo.ts). */
  video?: string;
  videoPoster?: string;
  onVideo: (video: string | undefined, poster: string | undefined) => void;
}

const tile = "flex flex-col gap-4 rounded-3xl border border-overlay/15 p-5";
const pill = "rounded-full border border-overlay/20 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-overlay/40 disabled:opacity-40";

/** Cover for a new story: a photo, a video, or both (photo = cover, video plays on hover). */
export function StoryCoverPicker({ photo, onPhoto, video, videoPoster, onVideo }: Props) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"photo" | "video" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownPhoto = safeThumbnail(photo);
  const shownVideoPoster = safeThumbnail(videoPoster);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("photo"); setError(null);
    try { onPhoto(await fileToThumbnail(file)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not use that image."); }
    finally { setBusy(null); if (photoInput.current) photoInput.current.value = ""; }
  }

  async function pickVideo(file: File | undefined) {
    if (!file) return;
    setBusy("video"); setError(null);
    try {
      const saved = await saveThumbnailVideo(file);
      if (video) void deleteThumbnailVideo(video);
      onVideo(saved.ref, saved.poster);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not use that video."); }
    finally { setBusy(null); if (videoInput.current) videoInput.current.value = ""; }
  }

  function removeVideo() {
    if (video) void deleteThumbnailVideo(video);
    onVideo(undefined, undefined);
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className={tile}>
          <div className="text-base font-medium text-ink">Photo</div>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-overlay/[0.05] text-ink-faint">
            {shownPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownPhoto} alt="Photo preview" className="h-full w-full object-cover" />
            ) : <ImagePlus className="h-7 w-7" />}
          </div>
          <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
          <div className="flex items-center gap-3">
            <button type="button" disabled={busy !== null} onClick={() => photoInput.current?.click()} className={pill}>
              {busy === "photo" ? "Working…" : shownPhoto ? "Change photo" : "Choose photo"}
            </button>
            {shownPhoto && (
              <button type="button" onClick={() => onPhoto(undefined)} aria-label="Remove photo" className="rounded-full p-2 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className={tile}>
          <div className="text-base font-medium text-ink">Video</div>
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-overlay/[0.05] text-ink-faint">
            {video && shownVideoPoster ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shownVideoPoster} alt="Video preview" className="h-full w-full object-cover" />
                <span className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white"><Play className="h-5 w-5" /></span>
              </>
            ) : video ? <Play className="h-7 w-7" /> : <Video className="h-7 w-7" />}
          </div>
          <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime,video/ogg" className="hidden" onChange={(e) => void pickVideo(e.target.files?.[0])} />
          <div className="flex items-center gap-3">
            <button type="button" disabled={busy !== null} onClick={() => videoInput.current?.click()} className={pill}>
              {busy === "video" ? "Working…" : video ? "Change video" : "Choose video"}
            </button>
            {video && (
              <button type="button" onClick={removeVideo} aria-label="Remove video" className="rounded-full p-2 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-muted">
        Add a photo, a video, or both. With both, the photo is the cover and the video plays when someone hovers over the card. With neither, a cover is generated from the title.
      </p>
      {error && <p className="mt-2 text-sm text-accent-extreme">{error}</p>}
    </div>
  );
}
