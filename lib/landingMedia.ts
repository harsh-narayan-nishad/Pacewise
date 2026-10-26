/** Photos/videos uploaded as landing-page backgrounds. Kept in IndexedDB (too big for localStorage). Browser-only. */
export interface BackgroundItem { id: string; kind: "image" | "video"; name: string; blob: Blob }

export const BG_IMAGE_MAX = 25 * 1024 * 1024;
export const BG_VIDEO_MAX = 80 * 1024 * 1024;
const DB = "speed-reader-backgrounds";
const STORE = "items";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open storage."));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Storage failed."));
    });
  } finally { db.close(); }
}

export async function addBackground(file: File): Promise<BackgroundItem> {
  const isImage = /^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type);
  const isVideo = /^video\/(mp4|webm|quicktime|ogg)$/i.test(file.type);
  if (!isImage && !isVideo) throw new Error("Choose a PNG, JPEG, WebP, GIF, MP4, WebM or MOV file.");
  if (isImage && file.size > BG_IMAGE_MAX) throw new Error("That photo is too large (max 25 MB).");
  if (isVideo && file.size > BG_VIDEO_MAX) throw new Error("That video is too large (max 80 MB).");
  const item: BackgroundItem = { id: `bg-${crypto.randomUUID()}`, kind: isImage ? "image" : "video", name: file.name.slice(0, 80), blob: file };
  await run("readwrite", (s) => s.put(item));
  return item;
}

export async function listBackgrounds(): Promise<BackgroundItem[]> {
  try { return await run<BackgroundItem[]>("readonly", (s) => s.getAll() as IDBRequest<BackgroundItem[]>); }
  catch { return []; }
}

const urls = new Map<string, string>();

export function urlFor(item: BackgroundItem): string {
  let u = urls.get(item.id);
  if (!u) { u = URL.createObjectURL(item.blob); urls.set(item.id, u); }
  return u;
}

export async function getBackground(id: string): Promise<BackgroundItem | null> {
  try { return (await run<BackgroundItem | undefined>("readonly", (s) => s.get(id) as IDBRequest<BackgroundItem | undefined>)) ?? null; }
  catch { return null; }
}

export async function deleteBackground(id: string): Promise<void> {
  const u = urls.get(id);
  if (u) { URL.revokeObjectURL(u); urls.delete(id); }
  try { await run("readwrite", (s) => s.delete(id)); } catch { /* best effort */ }
}
