import { fold, normalizeItems, RawItem } from './pdftext';
import { loadPages, savePages } from './textcache';
import type { BookDoc, PdfSource } from './types';

/* ------------------------------------------------------------------ *
 *  Index: the text of every page, extracted once and cached
 * ------------------------------------------------------------------ */

export interface SearchIndex {
    key: string;
    total: number;
    /** normalised text per page; null until that page has been read */
    pages: (string | null)[];
    /** folded (case-insensitive) copy of `pages` */
    lower: (string | null)[];
    filled: number;
    done: boolean;
    building: boolean;
}

const memory = new Map<string, SearchIndex>(); // in-memory cache, one index per book
const MAX_CACHED = 4;

export function getIndex(doc: BookDoc): SearchIndex {
    // a pages book changes when pages are added / removed / moved: `rev` makes that a new index
    const key = `${doc.key}#${doc.kind === 'pages' ? doc.rev : doc.pageCount}`;
    const hit = memory.get(key);
    if (hit) {
        memory.delete(key); // mark as recently used
        memory.set(key, hit);
        return hit;
    }
    const index: SearchIndex = {
        key,
        total: doc.pageCount,
        pages: new Array<string | null>(doc.pageCount).fill(null),
        lower: new Array<string | null>(doc.pageCount).fill(null),
        filled: 0,
        done: false,
        building: false,
    };
    memory.set(key, index);
    while (memory.size > MAX_CACHED) memory.delete(memory.keys().next().value as string);
    return index;
}

function setPage(index: SearchIndex, i: number, text: string) {
    if (index.pages[i] === null) index.filled++;
    index.pages[i] = text;
    index.lower[i] = fold(text);
}

/* ---- text of PDF pages, cached per source file (not per revision) ---- */

const sourceCache = new WeakMap<PdfSource, (string | null)[]>();
const hydrated = new WeakSet<PdfSource>();

function textsOf(src: PdfSource) {
    let t = sourceCache.get(src);
    if (!t) {
        t = new Array<string | null>(src.pageCount).fill(null);
        sourceCache.set(src, t);
    }
    return t;
}

/** Loads the saved text of a PDF from IndexedDB, if this file was indexed before. */
async function hydrateSource(src: PdfSource) {
    if (hydrated.has(src)) return;
    hydrated.add(src);
    const stored = await loadPages(src.key, src.pageCount);
    if (stored) {
        const t = textsOf(src);
        stored.forEach((text, i) => {
            if (t[i] === null) t[i] = text;
        });
    }
}

async function sourceText(src: PdfSource, i: number): Promise<string> {
    const t = textsOf(src);
    const cached = t[i];
    if (cached !== null) return cached;
    const page = await src.pdf.getPage(i + 1);
    const content = await page.getTextContent();
    const text = normalizeItems(content.items as RawItem[]).text;
    page.cleanup();
    t[i] = text;
    return text;
}

async function saveSource(src: PdfSource) {
    const t = textsOf(src);
    if (t.every((x) => x !== null)) await savePages(src.key, t as string[]);
}

/**
 * Reads the text of every page (not only the ones the reader has opened). Safe to call repeatedly:
 * finished or running indexes are left alone, and an interrupted one resumes where it stopped.
 */
export async function buildIndex(
    doc: BookDoc,
    index: SearchIndex,
    signal: { cancelled: boolean },
    onProgress: (filled: number, total: number) => void
): Promise<void> {
    if (index.done || index.building) return;
    index.building = true;
    try {
        if (doc.kind === 'text') {
            doc.pages.forEach((p, i) => setPage(index, i, p.blocks.map((b) => b.text).join(' ')));
            index.done = true;
            onProgress(index.filled, index.total);
            return;
        }

        // pages book: every PDF page's text is read once per source and shared by all revisions
        const items = doc.items;
        const sources = new Map<string, PdfSource>();
        items.forEach((it) => it.type === 'pdf' && sources.set(it.src.id, it.src));
        for (const src of sources.values()) {
            await hydrateSource(src);
            if (signal.cancelled) return;
        }

        let next = 0;
        const worker = async () => {
            while (!signal.cancelled) {
                const i = next++;
                if (i >= index.total) return;
                if (index.pages[i] !== null) continue;
                const item = items[i];
                if (item.type !== 'pdf') {
                    setPage(index, i, ''); // a picture has no text
                } else {
                    try {
                        setPage(index, i, await sourceText(item.src, item.index));
                    } catch {
                        if (signal.cancelled) return;
                        setPage(index, i, ''); // unreadable page: nothing to find on it
                    }
                }
                onProgress(index.filled, index.total);
            }
        };
        await Promise.all([worker(), worker(), worker()]); // 3 pages at a time
        if (signal.cancelled) return;

        index.done = true;
        onProgress(index.filled, index.total);
        for (const src of sources.values()) void saveSource(src);
    } finally {
        index.building = false;
    }
}

/* ------------------------------------------------------------------ *
 *  Searching
 * ------------------------------------------------------------------ */

export interface Hit {
    /** 0-based page of the file */
    page: number;
    /** which occurrence of `q` on that page this is (0-based), used to highlight the right one */
    occurrence: number;
    /** the folded text that was matched (the phrase, or a single word in word mode) */
    q: string;
    before: string;
    match: string;
    after: string;
    headCut: boolean;
    tailCut: boolean;
}

export interface SearchResult {
    hits: Hit[];
    mode: 'phrase' | 'words';
    pagesMatched: number;
    truncated: boolean;
}

export const MIN_QUERY = 2;
export const MAX_HITS = 300;
export const MAX_PER_PAGE = 6;
const CONTEXT_BEFORE = 36;
const CONTEXT_AFTER = 64;

/** Trims, drops surrounding quotes, collapses spaces and ignores case. */
export function parseQuery(raw: string): string {
    let q = raw.trim();
    if (q.length >= 2 && ((q.startsWith('"') && q.endsWith('"')) || (q.startsWith('\u201c') && q.endsWith('\u201d')))) q = q.slice(1, -1);
    return fold(q.replace(/\s+/g, ' ').trim());
}

function makeHit(text: string, page: number, at: number, len: number, occurrence: number, q: string): Hit {
    let s = Math.max(0, at - CONTEXT_BEFORE);
    if (s > 0) {
        const sp = text.indexOf(' ', s);
        if (sp >= 0 && sp < at) s = sp + 1;
    }
    let e = Math.min(text.length, at + len + CONTEXT_AFTER);
    if (e < text.length) {
        const sp = text.lastIndexOf(' ', e);
        if (sp > at + len) e = sp;
    }
    return {
        page,
        occurrence,
        q,
        before: text.slice(s, at),
        match: text.slice(at, at + len),
        after: text.slice(at + len, e),
        headCut: s > 0,
        tailCut: e < text.length,
    };
}

/**
 * Case-insensitive search over every page read so far. A query is a phrase ("tide lantern" finds those
 * words next to each other). If a multi-word phrase is nowhere to be found, pages that contain all of
 * the words are returned instead (mode 'words').
 */
export function search(index: SearchIndex, raw: string): SearchResult {
    const q = parseQuery(raw);
    const empty: SearchResult = { hits: [], mode: 'phrase', pagesMatched: 0, truncated: false };
    if (q.length < MIN_QUERY) return empty;

    const hits: Hit[] = [];
    const pagesWithHits = new Set<number>();
    let truncated = false;

    outer: for (let i = 0; i < index.total; i++) {
        const lower = index.lower[i];
        const text = index.pages[i];
        if (lower === null || text === null) continue;

        let from = 0;
        let n = 0;
        for (;;) {
            const at = lower.indexOf(q, from);
            if (at < 0) break;
            if (n < MAX_PER_PAGE) {
                hits.push(makeHit(text, i, at, q.length, n, q));
                pagesWithHits.add(i);
                if (hits.length >= MAX_HITS) {
                    truncated = true;
                    break outer;
                }
            }
            n++;
            from = at + q.length;
        }
    }
    if (hits.length > 0 || !q.includes(' ')) return { hits, mode: 'phrase', pagesMatched: pagesWithHits.size, truncated };

    // fall back to "all of these words on the same page"
    const words = Array.from(new Set(q.split(' ').filter((w) => w.length >= MIN_QUERY)));
    if (words.length < 2) return empty;
    for (let i = 0; i < index.total; i++) {
        const lower = index.lower[i];
        const text = index.pages[i];
        if (lower === null || text === null) continue;
        if (!words.every((w) => lower.includes(w))) continue;
        const at = lower.indexOf(words[0]);
        hits.push(makeHit(text, i, at, words[0].length, 0, words[0]));
        if (hits.length >= MAX_HITS) {
            truncated = true;
            break;
        }
    }
    return { hits, mode: 'words', pagesMatched: hits.length, truncated };
}
