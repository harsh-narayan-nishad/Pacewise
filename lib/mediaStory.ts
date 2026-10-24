"use client";

import { StoryData, StoryMedia, StoryMediaPage } from "@/types";

/**
 * Turns an uploaded PDF or image file into a `StoryData` — the "upload a
 * PDF/image and read it with the same auto-scroll + controls as text"
 * feature. Everything downstream (the auto-scroll engine, Play/Pause/
 * Restart/Skip, WPM speed, the Speedometer, break tracking, the progress
 * bar, keyboard shortcuts, fullscreen) stays completely unchanged: a
 * media story is still an ordinary `StoryData`, just with `story`/
 * `questions` empty and a `media` object instead — see
 * components/Reader/MediaReader.tsx (the rendering counterpart to
 * Reader.tsx) and app/reader/page.tsx (which picks between the two based
 * on `story.media`).
 *
 * Deliberately *not* run through `lib/stories.ts`'s `loadStory`/
 * `addCustomStory` — that path validates and requires non-empty `story`/
 * `questions` arrays (a real text story's contract) and persists to
 * `localStorage` via lib/storage.ts, which is the wrong fit here twice
 * over: a media story has neither paragraphs nor comprehension questions
 * by nature, and a multi-page PDF's rendered page images can easily be
 * tens of megabytes — far past what's reasonable to keep in
 * `localStorage`. This is a read-it-now upload: it lives only in
 * `ReadingContext` state for the session, same as any in-memory object;
 * re-upload the file to read it again after a refresh.
 */

export class MediaStoryError extends Error {}

/** Rough "glance time" word-equivalent for one page with no text layer to
 *  measure (a plain image, or a scanned PDF page) — tuned so a single
 *  page reads at roughly the same felt pace as a short paragraph at a
 *  typical WPM, not an instant flash or a multi-minute stare. */
const WORDS_PER_UNMEASURED_PAGE = 180;

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
  "image/avif",
]);

/** Whether a given uploaded file should go through this module instead of
 *  the existing JSON-story path — checked by MIME type first (reliable
 *  when the browser sets it), falling back to the file extension for the
 *  odd case a browser/OS hands back an empty/generic MIME type. */
export function isMediaFile(file: File): boolean {
  if (file.type === "application/pdf" || IMAGE_MIME_TYPES.has(file.type)) return true;
  return /\.(pdf|png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name);
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new MediaStoryError(`Couldn't read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => reject(new MediaStoryError("That image file couldn't be decoded."));
    img.src = src;
  });
}

async function buildImageMedia(file: File): Promise<StoryMedia> {
  const src = await readAsDataURL(file);
  const { width, height } = await loadImageDimensions(src);
  return {
    kind: "image",
    pages: [{ src, width, height }],
    estimatedWordCount: WORDS_PER_UNMEASURED_PAGE,
  };
}

/** Renders every page of a PDF to a PNG data URL via pdf.js's canvas API
 *  (entirely client-side — no server round-trip) and, where the PDF has a
 *  real text layer, extracts it to drive the existing WPM timing engine
 *  with a genuine word count instead of a flat guess. A scanned PDF with
 *  no text layer on a given page falls back to the same per-page estimate
 *  used for a plain image.
 *
 *  pdf.js is imported dynamically (never at module scope) so it's only
 *  ever pulled into the client bundle, on demand, the moment someone
 *  actually uploads a PDF — never during a server render, and not adding
 *  to the weight of every other page. Note: this project has never had
 *  network access to run `npm install` and build in this sandbox (same
 *  constraint noted throughout the README), so this wiring — the
 *  dynamic import plus the worker URL below, both the standard pattern
 *  for pdf.js under a webpack-based bundler like Next.js — is unverified
 *  by an actual build here; if the exact `pdfjs-dist` version `npm
 *  install` resolves ships its worker under a different path, adjust the
 *  `workerSrc` URL below to match.
 */
async function buildPdfMedia(file: File): Promise<StoryMedia> {
  // The "legacy" build is pre-transpiled for wider browser support, which Next's SWC
  // minifier can parse (the modern build breaks `next build` with "failed to parse
  // input file"). The worker is NOT bundled: scripts/copy-pdf-worker.mjs copies it into
  // /public before dev/build, and it is loaded from there at runtime.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pages: StoryMediaPage[] = [];
  let wordCount = 0;

  // Capped so a genuinely enormous PDF can't lock up the tab rendering
  // hundreds of full-resolution canvases — generous enough for any normal
  // document (an article, a chapter, a slide-deck export).
  const pageCount = Math.min(pdf.numPages, 300);

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // Scale 3.5 renders at 3.5x the PDF's native CSS resolution — enough
    // headroom that the in-reader zoom control (MediaReader.tsx, now up to
    // 500%) stays crisp instead of visibly pixelating a raster that was
    // only ever rendered at a lower scale, while still being well short of
    // full device-pixel-ratio-on-every-page memory cost.
    const viewport = page.getViewport({ scale: 3.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new MediaStoryError("This browser can't render PDF pages to a canvas.");

    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ src: canvas.toDataURL("image/png"), width: viewport.width, height: viewport.height });

    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    const pageWords = pageText.trim().split(/\s+/).filter(Boolean).length;
    wordCount += pageWords > 0 ? pageWords : WORDS_PER_UNMEASURED_PAGE;
  }

  return { kind: "pdf", pages, estimatedWordCount: Math.max(wordCount, pages.length * 20) };
}

/** The main entry point: file in, ready-to-read `StoryData` out. Throws
 *  `MediaStoryError` (or lets a pdf.js error through) on anything that
 *  can't be turned into at least one page — callers should catch this and
 *  show the message, the same way `AddStoryModal` surfaces
 *  `StoryValidationError`. */
export async function buildMediaStory(file: File): Promise<StoryData> {
  const isPdf = isPdfFile(file);
  const media = isPdf ? await buildPdfMedia(file) : await buildImageMedia(file);

  if (media.pages.length === 0) {
    throw new MediaStoryError("No readable pages were found in that file.");
  }

  const title = file.name.replace(/\.[^./\\]+$/, "").trim() || (isPdf ? "Uploaded PDF" : "Uploaded image");
  const estimatedWPM = 200;

  return {
    id: `media-${Date.now()}`,
    title,
    description: isPdf
      ? `Uploaded PDF · ${media.pages.length} page${media.pages.length === 1 ? "" : "s"}`
      : "Uploaded image",
    level: "Intermediate",
    difficulty: "Intermediate",
    estimatedWPM,
    estimatedReadingTime: Math.max(1, Math.round(media.estimatedWordCount / estimatedWPM)),
    tags: isPdf ? ["pdf", "upload"] : ["image", "upload"],
    story: [],
    questions: [],
    media,
  };
}
