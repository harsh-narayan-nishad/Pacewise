import { newId } from './pages';
import type { ImageEdit, ImageSource } from './types';

/* ------------------------------------------------------------------ *
 *  Importing: decode, scale down and store as a compact JPEG
 * ------------------------------------------------------------------ */

export const MAX_IMPORT_SIDE = 2400;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

export const isImageFile = (f: File) => /^image\/(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);

export const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), type, quality));

export async function fileToImageSource(file: File): Promise<ImageSource> {
    if (file.size > MAX_IMAGE_BYTES) throw new Error(`"${file.name}" is too large (limit 40 MB).`);
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error(`"${file.name}" could not be read as an image.`);
    }
    const scale = Math.min(1, MAX_IMPORT_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        bitmap.close();
        throw new Error('Could not process the image.');
    }
    ctx.fillStyle = '#fff'; // flatten transparency
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await toBlob(canvas, 'image/jpeg', 0.92);
    return { id: newId(), kind: 'image', name: file.name, blob, width, height };
}

/* ------------------------------------------------------------------ *
 *  Decoded pictures (kept for a short while, newest first)
 * ------------------------------------------------------------------ */

const bitmaps = new Map<string, Promise<ImageBitmap>>();
const KEEP_BITMAPS = 12;

export function getBitmap(src: ImageSource): Promise<ImageBitmap> {
    let p = bitmaps.get(src.id);
    if (p) {
        bitmaps.delete(src.id);
        bitmaps.set(src.id, p);
        return p;
    }
    p = createImageBitmap(src.blob);
    bitmaps.set(src.id, p);
    while (bitmaps.size > KEEP_BITMAPS) bitmaps.delete(bitmaps.keys().next().value as string); // let the GC free it
    return p;
}

/* ------------------------------------------------------------------ *
 *  The edit pipeline: flip, rotate, straighten, crop, then colour
 * ------------------------------------------------------------------ */

const rad = (d: number) => (d * Math.PI) / 180;

/** Size of the picture after the quarter turn, before straightening and cropping. */
export const turnedSize = (w: number, h: number, e: ImageEdit): [number, number] => (e.rotate % 180 !== 0 ? [h, w] : [w, h]);

function colour(ctx: CanvasRenderingContext2D, w: number, h: number, e: ImageEdit) {
    if (!e.brightness && !e.contrast && !e.saturation && !e.warmth && !e.sharpen && e.filter === 'none') return;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    const add = e.brightness * 1.275;
    const c = e.contrast * 2.55;
    const cf = (259 * (c + 255)) / (255 * (259 - c));
    const warm = e.warmth * 0.45;
    let sat = 1 + e.saturation / 100;
    let punch = 1;
    let lift = 0;
    const mono = e.filter === 'mono';
    const sepia = e.filter === 'sepia';
    const invert = e.filter === 'invert';
    if (e.filter === 'vivid') {
        sat *= 1.35;
        punch = 1.12;
    } else if (e.filter === 'fade') {
        sat *= 0.85;
        punch = 0.88;
        lift = 28;
    }

    for (let i = 0; i < d.length; i += 4) {
        let r = d[i] + add + warm;
        let g = d[i + 1] + add;
        let b = d[i + 2] + add - warm;
        if (cf !== 1) {
            r = cf * (r - 128) + 128;
            g = cf * (g - 128) + 128;
            b = cf * (b - 128) + 128;
        }
        if (punch !== 1) {
            r = punch * (r - 128) + 128;
            g = punch * (g - 128) + 128;
            b = punch * (b - 128) + 128;
        }
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        if (sat !== 1) {
            r = gray + (r - gray) * sat;
            g = gray + (g - gray) * sat;
            b = gray + (b - gray) * sat;
        }
        if (mono) {
            r = g = b = gray;
        } else if (sepia) {
            const nr = 0.393 * r + 0.769 * g + 0.189 * b;
            const ng = 0.349 * r + 0.686 * g + 0.168 * b;
            const nb = 0.272 * r + 0.534 * g + 0.131 * b;
            r = nr;
            g = ng;
            b = nb;
        }
        if (lift) {
            const k = 1 - lift / 255;
            r = r * k + lift;
            g = g * k + lift;
            b = b * k + lift;
        }
        if (invert) {
            r = 255 - r;
            g = 255 - g;
            b = 255 - b;
        }
        d[i] = r; // a Uint8ClampedArray clamps for us
        d[i + 1] = g;
        d[i + 2] = b;
    }
    ctx.putImageData(img, 0, 0);

    if (e.sharpen > 0) {
        // unsharp mask: add back the difference between each pixel and its 3 x 3 average
        const src = ctx.getImageData(0, 0, w, h);
        const s = src.data;
        const out = ctx.createImageData(w, h);
        const o = out.data;
        const amount = (e.sharpen / 100) * 1.6;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const p = (y * w + x) * 4;
                for (let k = 0; k < 3; k++) {
                    let sum = 0;
                    let n = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        const yy = y + dy;
                        if (yy < 0 || yy >= h) continue;
                        for (let dx = -1; dx <= 1; dx++) {
                            const xx = x + dx;
                            if (xx < 0 || xx >= w) continue;
                            sum += s[(yy * w + xx) * 4 + k];
                            n++;
                        }
                    }
                    o[p + k] = s[p + k] + amount * (s[p + k] - sum / n);
                }
                o[p + 3] = s[p + 3];
            }
        }
        ctx.putImageData(out, 0, 0);
    }
}

/**
 * Applies the edit and returns a canvas whose longest side is at most `maxSide` pixels.
 * `src` is never modified.
 */
export function renderEdit(src: ImageBitmap, edit: ImageEdit, maxSide = Infinity): HTMLCanvasElement {
    const [rw, rh] = turnedSize(src.width, src.height, edit);
    const cropW = edit.crop ? rw * edit.crop.w : rw;
    const cropH = edit.crop ? rh * edit.crop.h : rh;
    const s = Math.min(1, maxSide / Math.max(cropW, cropH, 1));

    // stage 1: the whole turned picture, at the output scale
    const aw = Math.max(1, Math.round(rw * s));
    const ah = Math.max(1, Math.round(rh * s));
    const a = document.createElement('canvas');
    a.width = aw;
    a.height = ah;
    const ctx = a.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, aw, ah);
    ctx.save();
    ctx.translate(aw / 2, ah / 2);
    const th = Math.abs(rad(edit.straighten));
    ctx.rotate(rad(edit.straighten));
    // zoom just enough that the straightened picture still fills the frame
    const zoom = Math.cos(th) + Math.sin(th) * Math.max(aw / ah, ah / aw);
    ctx.scale(zoom, zoom);
    ctx.rotate(rad(edit.rotate));
    ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1);
    const dw = src.width * s;
    const dh = src.height * s;
    ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // stage 2: crop
    let out = a;
    if (edit.crop) {
        const cx = Math.round(edit.crop.x * aw);
        const cy = Math.round(edit.crop.y * ah);
        const cw = Math.max(1, Math.min(aw - cx, Math.round(edit.crop.w * aw)));
        const ch = Math.max(1, Math.min(ah - cy, Math.round(edit.crop.h * ah)));
        out = document.createElement('canvas');
        out.width = cw;
        out.height = ch;
        const octx = out.getContext('2d', { willReadFrequently: true })!;
        octx.drawImage(a, cx, cy, cw, ch, 0, 0, cw, ch);
    }

    // stage 3: brightness, contrast, colour, filters, sharpness
    colour(out.getContext('2d', { willReadFrequently: true })!, out.width, out.height, edit);
    return out;
}

/** The edited picture as a file (used for merged PDFs). */
export async function editedBlob(src: ImageSource, edit: ImageEdit, maxSide = MAX_IMPORT_SIDE): Promise<{ blob: Blob; width: number; height: number }> {
    const bitmap = await getBitmap(src);
    const canvas = renderEdit(bitmap, edit, maxSide);
    return { blob: await toBlob(canvas, 'image/jpeg', 0.92), width: canvas.width, height: canvas.height };
}
