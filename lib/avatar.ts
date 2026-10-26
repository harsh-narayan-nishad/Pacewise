/**
 * Turns a picked image into a small square JPEG data URL for a profile photo
 * (centre-cropped, 256px). Small enough to live in the dev store's localStorage
 * snapshot. Browser-only.
 */
export const AVATAR_SIZE = 256;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export async function fileToAvatar(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type)) throw new Error("Choose a PNG, JPEG, WebP or GIF image.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("That image is too large (max 8 MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read that image."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Only our own downscaled JPEG data URLs are ever rendered as an avatar. */
export function safeAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value) && value.length < 400_000 ? value : null;
}
