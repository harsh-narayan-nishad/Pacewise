/**
 * Optional hover-video for a story card. A video is far too big for localStorage
 * (where stories live), so the file is kept in IndexedDB and the story only stores a
 * short reference id in `thumbnailVideo`. Browser-only.
 */
export const THUMB_VIDEO_MAX_BYTES = 40 * 1024 * 1024;
const DB_NAME = "speed-reader-media";
const STORE = "videos";
const ALLOWED = /^video\/(mp4|webm|quicktime|ogg)$/i;

export function isVideoRef(value: unknown): value is string {
  return typeof value === "string" && /^vid-[a-z0-9-]{8,64}$/i.test(value);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open video storage."));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Video storage failed."));
    });
  } finally {
    db.close();
  }
}

/** A JPEG still from the video (used as the cover when no photo is chosen). */
async function posterFrom(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const done = (val?: string) => { v.removeAttribute("src"); v.load(); resolve(val); };
    const timer = window.setTimeout(() => done(undefined), 6000);
    v.onerror = () => { window.clearTimeout(timer); done(undefined); };
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      window.clearTimeout(timer);
      try {
        const scale = Math.min(1, 1000 / (v.videoWidth || 1000));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round((v.videoWidth || 1000) * scale));
        c.height = Math.max(1, Math.round((v.videoHeight || 562) * scale));
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
        done(c.toDataURL("image/jpeg", 0.82));
      } catch { done(undefined); }
    };
    v.src = url;
  });
}

export async function saveThumbnailVideo(file: File): Promise<{ ref: string; poster?: string }> {
  if (!ALLOWED.test(file.type)) throw new Error("Choose an MP4, WebM or MOV video.");
  if (file.size > THUMB_VIDEO_MAX_BYTES) throw new Error("That video is too large (max 40 MB).");
  const ref = `vid-${crypto.randomUUID()}`;
  await tx("readwrite", (s) => s.put(file, ref));
  const url = URL.createObjectURL(file);
  try {
    return { ref, poster: await posterFrom(url) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const urlCache = new Map<string, string>();

/** An object URL for a stored video (cached), or null if it is gone. */
export async function loadThumbnailVideoUrl(ref: string): Promise<string | null> {
  if (!isVideoRef(ref)) return null;
  const cached = urlCache.get(ref);
  if (cached) return cached;
  try {
    const blob = await tx<Blob | undefined>("readonly", (s) => s.get(ref) as IDBRequest<Blob | undefined>);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(ref, url);
    return url;
  } catch {
    return null;
  }
}

export async function deleteThumbnailVideo(ref: string | undefined): Promise<void> {
  if (!ref || !isVideoRef(ref)) return;
  const cached = urlCache.get(ref);
  if (cached) { URL.revokeObjectURL(cached); urlCache.delete(ref); }
  try { await tx("readwrite", (s) => s.delete(ref)); } catch { /* best effort */ }
}
