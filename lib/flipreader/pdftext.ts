/**
 * Turns pdf.js text items into one searchable string, and (optionally) a map from every character
 * of that string back to the item and character it came from, so a match can be highlighted on the page.
 * Used both for building the search index and for highlighting, so both always agree on offsets.
 */
export interface RawItem {
    str?: string;
    transform?: number[];
    width?: number;
    height?: number;
}

export interface CharRef {
    item: number;
    char: number;
}

export interface PageText {
    text: string;
    map?: CharRef[];
}

const isSpace = (ch: string) => ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\u00a0' || ch === '\u2009';

export function normalizeItems(items: RawItem[], withMap = false): PageText {
    let text = '';
    const map: CharRef[] | undefined = withMap ? [] : undefined;
    let lastSpace = true;

    for (let i = 0; i < items.length; i++) {
        const s = items[i].str;
        if (!s) continue;
        for (let k = 0; k < s.length; k++) {
            const ch = s[k];
            if (ch === '\u00ad') continue; // soft hyphen
            if (isSpace(ch)) {
                if (!lastSpace) {
                    text += ' ';
                    map?.push({ item: i, char: k });
                    lastSpace = true;
                }
            } else {
                text += ch;
                map?.push({ item: i, char: k });
                lastSpace = false;
            }
        }
        if (!lastSpace) {
            text += ' '; // items are separated by a space
            map?.push({ item: i, char: s.length });
            lastSpace = true;
        }
    }
    if (text.endsWith(' ')) {
        text = text.slice(0, -1);
        map?.pop();
    }
    return { text, map };
}

/** Lower-cases without changing the string length, so offsets stay valid. */
export function fold(text: string): string {
    const lower = text.toLowerCase();
    return lower.length === text.length ? lower : text.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** Start offset of the n-th (0-based, non-overlapping) occurrence of `q` (already folded) in `text`. */
export function findOccurrence(text: string, q: string, occurrence: number): number {
    if (!q) return -1;
    const lower = fold(text);
    let from = 0;
    for (let n = 0; ; n++) {
        const at = lower.indexOf(q, from);
        if (at < 0) return -1;
        if (n === occurrence) return at;
        from = at + q.length;
    }
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

type Matrix = number[];
const mul = (m: Matrix, n: Matrix): Matrix => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
];

/**
 * Rectangles (in viewport pixels) covering characters [start, end) of the page text.
 * Character positions inside an item are estimated proportionally to its width.
 */
export function rectsForRange(
    items: RawItem[],
    map: CharRef[],
    start: number,
    end: number,
    viewportTransform: number[],
    viewportScale: number
): Rect[] {
    const spans = new Map<number, { from: number; to: number }>();
    for (let k = start; k < end && k < map.length; k++) {
        const { item, char } = map[k];
        const len = items[item].str?.length ?? 0;
        if (char >= len) continue; // the separator we added
        const span = spans.get(item);
        if (!span) spans.set(item, { from: char, to: char + 1 });
        else span.to = char + 1;
    }

    const rects: Rect[] = [];
    spans.forEach((span, idx) => {
        const it = items[idx];
        if (!it.transform || !it.str) return;
        const len = it.str.length;
        const tx = mul(viewportTransform, it.transform);
        const widthPx = (it.width ?? 0) * viewportScale;
        const fontPx = Math.hypot(tx[2], tx[3]) || (it.height ?? 10) * viewportScale;
        const ux = Math.hypot(tx[0], tx[1]) || 1;
        const dx = tx[0] / ux;
        const dy = tx[1] / ux;
        const vx = (tx[2] / (fontPx || 1)) * fontPx;
        const vy = (tx[3] / (fontPx || 1)) * fontPx;

        const a = (span.from / len) * widthPx;
        const b = (span.to / len) * widthPx;
        const p0 = { x: tx[4] + dx * a, y: tx[5] + dy * a };
        const p1 = { x: tx[4] + dx * b, y: tx[5] + dy * b };
        const xs = [p0.x, p1.x, p0.x + vx, p1.x + vx];
        const ys = [p0.y, p1.y, p0.y + vy, p1.y + vy];
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        rects.push({ x: x - 1, y: y - 1, w: Math.max(...xs) - x + 2, h: Math.max(...ys) - y + 2 });
    });
    return rects;
}
