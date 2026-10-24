/**
 * Turns a picked image file into a small JPEG data URL for use as a story
 * thumbnail (stories live in localStorage, so the picture is downscaled to
 * keep each one around 100–250 KB). Browser-only.
 */
export const THUMB_MAX_WIDTH = 1000;
export const THUMB_MAX_INPUT_BYTES = 12 * 1024 * 1024;

export async function fileToThumbnail(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type)) throw new Error("Choose a PNG, JPEG, WebP or GIF image.");
  if (file.size > THUMB_MAX_INPUT_BYTES) throw new Error("That image is too large (max 12 MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read that image."));
      i.src = url;
    });
    const scale = Math.min(1, THUMB_MAX_WIDTH / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Only our own downscaled JPEG data URLs (or https images) are ever rendered as a thumbnail. */
export function safeThumbnail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length < 2_000_000) return value;
  return null;
}
