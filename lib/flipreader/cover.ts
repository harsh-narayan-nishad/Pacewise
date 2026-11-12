/** Editable design of the front and back cover. Everything stays in the browser (localStorage). */
export interface CoverDesign {
    /** Show a front cover (with a blank inside) and a back cover (with a blank inside) */
    covers: boolean;

    title: string;
    subtitle: string;
    author: string;
    color: string;
    textColor: string;
    /** Replaces the typographic front cover when set (JPEG data URL) */
    frontImage: string | null;

    backText: string;
    backColor: string;
    /** Replaces the typographic back cover when set (JPEG data URL) */
    backImage: string | null;
}

export const DEFAULT_COLOR = '#1d4a5a';
export const DEFAULT_TEXT_COLOR = '#f3ead8';

const LIMITS = { title: 120, subtitle: 160, author: 120, backText: 1200 } as const;
const MAX_IMAGE_CHARS = 3_000_000;

export const defaultDesign = (title = ''): CoverDesign => ({
    covers: true,
    title: title.slice(0, LIMITS.title),
    subtitle: '',
    author: '',
    color: DEFAULT_COLOR,
    textColor: DEFAULT_TEXT_COLOR,
    frontImage: null,
    backText: '',
    backColor: DEFAULT_COLOR,
    backImage: null,
});

/* ------------------------- validation ------------------------- */

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const str = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.slice(0, max) : fallback);
// Only raster images produced by imageToDataUrl() are accepted (never SVG)
const img = (v: unknown): string | null =>
    typeof v === 'string' && v.startsWith('data:image/jpeg;base64,') && v.length <= MAX_IMAGE_CHARS ? v : null;

/** Turns anything read from storage into a safe, complete design. */
export function sanitizeDesign(raw: unknown, fallbackTitle = ''): CoverDesign {
    const base = defaultDesign(fallbackTitle);
    if (!raw || typeof raw !== 'object') return base;
    const r = raw as Record<string, unknown>;
    return {
        covers: typeof r.covers === 'boolean' ? r.covers : base.covers,
        title: str(r.title, LIMITS.title, base.title),
        subtitle: str(r.subtitle, LIMITS.subtitle, base.subtitle),
        author: str(r.author, LIMITS.author, base.author),
        color: isHex(r.color) ? r.color : base.color,
        textColor: isHex(r.textColor) ? r.textColor : base.textColor,
        frontImage: img(r.frontImage),
        backText: str(r.backText, LIMITS.backText, base.backText),
        backColor: isHex(r.backColor) ? r.backColor : base.backColor,
        backImage: img(r.backImage),
    };
}

export const COVER_LIMITS = LIMITS;

/* ------------------------- storage ------------------------- */

const PREFIX = 'reader.cover.v1.';
const INDEX = 'reader.cover.index';
const KEEP = 20; // remember the designs of the 20 most recent books

export function loadDesign(key: string, fallbackTitle: string): CoverDesign | null {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? sanitizeDesign(JSON.parse(raw), fallbackTitle) : null;
    } catch {
        return null;
    }
}

function write(key: string, design: CoverDesign) {
    localStorage.setItem(PREFIX + key, JSON.stringify(design));
    const index: string[] = JSON.parse(localStorage.getItem(INDEX) || '[]');
    const next = [key, ...index.filter((k) => k !== key)];
    for (const old of next.splice(KEEP)) localStorage.removeItem(PREFIX + old);
    localStorage.setItem(INDEX, JSON.stringify(next));
}

export function saveDesign(key: string, design: CoverDesign) {
    try {
        write(key, design);
    } catch {
        try {
            write(key, { ...design, frontImage: null, backImage: null }); // storage full: keep the text settings
        } catch {
            /* storage unavailable */
        }
    }
}

/* ------------------------- helpers ------------------------- */

export function hexToRgba(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Reads an image file, scales it down (max 1400px on the long side) and returns a JPEG data URL,
 * small enough to keep in localStorage. Throws a user-friendly Error.
 */
export async function imageToDataUrl(file: File, maxSide = 1400): Promise<string> {
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(file.type)) throw new Error('Please choose a PNG, JPG or WebP image.');
    if (file.size > 15 * 1024 * 1024) throw new Error('This image is too large (limit 15 MB).');

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error('Could not read this image.');
    }

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        bitmap.close();
        throw new Error('Could not process this image.');
    }
    ctx.fillStyle = '#fff'; // flatten transparency
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const url = canvas.toDataURL('image/jpeg', 0.88);
    if (url.length > MAX_IMAGE_CHARS) throw new Error('This image is too detailed. Try a smaller one.');
    return url;
}
