import { fileToImageSource, isImageFile } from './imageops';
import { docRatio, imageItem, newId, pdfItems } from './pages';
import { paginate } from './paginate';
import type { Block, BookDoc, PageItem, PagesDoc, PdfSource, Source } from './types';

export type ProgressFn = (message: string, fraction?: number) => void;

let counter = 0;
const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');
const keyOf = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;

export const ACCEPT =
    '.pdf,.epub,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,application/pdf,application/epub+zip,text/plain,text/markdown,image/*';

/** Files that can be inserted as extra pages: images and PDFs. */
export const ACCEPT_PAGES = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,application/pdf,image/*';

const MB = 1024 * 1024;
const LIMITS = { pdf: 300 * MB, epub: 80 * MB, text: 20 * MB } as const;

function assertSize(file: File, kind: keyof typeof LIMITS) {
    if (file.size === 0) throw new Error('This file is empty.');
    if (file.size > LIMITS[kind]) {
        throw new Error(`This file is too large (limit ${LIMITS[kind] / MB} MB for this type).`);
    }
}

const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isEpubFile = (f: File) => f.type === 'application/epub+zip' || /\.epub$/i.test(f.name);
const isTextFile = (f: File) => /\.(txt|md)$/i.test(f.name) || f.type.startsWith('text/');

/** Opens a PDF so its pages can be read, searched and copied into a merged PDF. */
export async function openPdfSource(file: File, onProgress?: ProgressFn): Promise<PdfSource> {
    assertSize(file, 'pdf');
    onProgress?.(`Opening ${file.name}…`);
    // pdf.js (~400 KB) is only downloaded when a PDF is actually opened
    // the same (legacy) build as the worker file Pacewise copies into /public, so the two always match
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // the worker file named after this exact pdf.js version (written by scripts/copy-pdf-worker.mjs), so the two always match
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker-${pdfjs.version}.min.mjs`;

    try {
        const data = new Uint8Array(await file.arrayBuffer()); // the original File is kept for exporting
        const pdf = await pdfjs.getDocument({
            data,
            // fonts and character maps are served from /public/pdfjs (see scripts/copy-pdf-worker.mjs)
            cMapUrl: '/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/pdfjs/standard_fonts/',
            // never run code from inside a PDF (also keeps the strict CSP happy)
            isEvalSupported: false,
        }).promise;
        const first = await pdf.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        return {
            id: newId(),
            kind: 'pdf',
            name: file.name,
            key: keyOf(file),
            file,
            pdf,
            pageCount: pdf.numPages,
            ratio: vp.height / vp.width,
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (/password/i.test(msg)) throw new Error(`"${file.name}" is password protected.`);
        throw new Error(`Could not open "${file.name}". The file may be damaged.${msg ? ` (${msg.slice(0, 120)})` : ''}`);
    }
}

export interface LoadedPages {
    items: PageItem[];
    sources: Source[];
    /** files that were skipped, with the reason */
    warnings: string[];
}

/** Turns images and PDFs into pages, in the order given. Unreadable files are skipped and reported. */
export async function loadPagesFromFiles(files: File[], onProgress: ProgressFn): Promise<LoadedPages> {
    const items: PageItem[] = [];
    const sources: Source[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        onProgress(`Reading ${file.name} (${i + 1} of ${files.length})…`, i / files.length);
        try {
            if (isPdfFile(file)) {
                const src = await openPdfSource(file);
                sources.push(src);
                items.push(...pdfItems(src));
            } else if (isImageFile(file)) {
                const src = await fileToImageSource(file);
                sources.push(src);
                items.push(imageItem(src));
            } else {
                warnings.push(`"${file.name}" is not an image or PDF.`);
            }
        } catch (e) {
            warnings.push(e instanceof Error ? e.message : `"${file.name}" could not be opened.`);
        }
    }
    onProgress('Done', 1);
    return { items, sources, warnings };
}

/** A short stable key for a set of files (used to remember the cover design of a book). */
const hashKey = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
};

export interface LoadedBook {
    doc: BookDoc;
    warnings: string[];
}

/**
 * Opens one or more files as a book. Images and PDFs can be combined into one book;
 * a text / EPUB file is opened on its own.
 */
export async function loadFiles(files: File[], onProgress: ProgressFn): Promise<LoadedBook> {
    if (files.length === 0) throw new Error('No file was chosen.');

    const texts = files.filter((f) => isEpubFile(f) || isTextFile(f));
    if (texts.length > 0) {
        if (files.length > 1) {
            throw new Error('Text and EPUB books open on their own. Choose images and PDFs together, or one text file.');
        }
        const file = texts[0];
        const doc = isEpubFile(file) ? await loadEpub(file, onProgress) : await loadText(file, onProgress);
        return { doc, warnings: [] };
    }

    const { items, sources, warnings } = await loadPagesFromFiles(files, onProgress);
    if (items.length === 0) {
        throw new Error(warnings[0] || 'Unsupported file. Please choose PDF, EPUB, TXT or image files.');
    }
    const first = stripExt(files[0].name);
    const doc: PagesDoc = {
        id: ++counter,
        key: hashKey(files.map(keyOf).join('||')),
        kind: 'pages',
        title: files.length > 1 ? `${first} + ${files.length - 1} more` : first,
        pageCount: items.length,
        items,
        sources,
        ratio: docRatio(items),
        rev: 0,
    };
    return { doc, warnings };
}

/* ----------------------------- TEXT ------------------------------ */

async function loadText(file: File, onProgress: ProgressFn): Promise<BookDoc> {
    assertSize(file, 'text');
    onProgress('Reading text…');
    const raw = (await file.text()).replace(/\r\n?/g, '\n');
    const title = stripExt(file.name);

    const blocks: Block[] = [{ type: 'h', text: title }, { type: 'break' }];
    for (const chunk of raw.split(/\n\s*\n/)) {
        const text = chunk.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const heading = /^#{1,6}\s+(.*)$/.exec(text);
        blocks.push(heading ? { type: 'h', text: heading[1] } : { type: 'p', text });
    }
    return finishText(file, title, blocks, onProgress);
}

/* ----------------------------- EPUB ------------------------------ */

async function loadEpub(file: File, onProgress: ProgressFn): Promise<BookDoc> {
    assertSize(file, 'epub');
    onProgress('Opening EPUB…');
    const JSZip = (await import('jszip')).default;

    const zip = await JSZip.loadAsync(await file.arrayBuffer()).catch(() => {
        throw new Error('Could not open this EPUB. The file may be damaged.');
    });

    const read = async (path: string) => {
        const f = zip.file(path);
        return f ? f.async('string') : null;
    };
    const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');

    const container = await read('META-INF/container.xml');
    const opfPath = container ? xml(container).querySelector('rootfile')?.getAttribute('full-path') : null;
    const opfText = opfPath ? await read(opfPath) : null;
    if (!opfPath || !opfText) throw new Error('This EPUB has no readable content.');

    const opf = xml(opfText);
    const dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const title = opf.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim() || stripExt(file.name);

    const manifest = new Map<string, string>();
    opf.querySelectorAll('manifest > item').forEach((it) => {
        const id = it.getAttribute('id');
        const href = it.getAttribute('href');
        if (id && href) manifest.set(id, href);
    });
    const spine = Array.from(opf.querySelectorAll('spine > itemref'))
        .map((r) => r.getAttribute('idref'))
        .filter((id): id is string => !!id);

    const blocks: Block[] = [{ type: 'h', text: title }, { type: 'break' }];
    const TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,pre';

    for (let i = 0; i < spine.length; i++) {
        onProgress(`Reading chapter ${i + 1} of ${spine.length}…`, i / spine.length);
        const href = manifest.get(spine[i]);
        if (!href) continue;
        const path = decodeURIComponent(new URL(href, `http://epub/${dir}`).pathname.slice(1));
        const html = await read(path);
        if (!html) continue;

        const body = new DOMParser().parseFromString(html, 'text/html').body;
        if (!body) continue;

        blocks.push({ type: 'break' });
        let found = false;
        body.querySelectorAll(TEXT_SELECTOR).forEach((el) => {
            if (el.parentElement?.closest(TEXT_SELECTOR)) return; // avoid duplicating nested text
            const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) return;
            blocks.push({ type: /^H[1-6]$/.test(el.tagName) ? 'h' : 'p', text });
            found = true;
        });
        if (!found) {
            for (const chunk of (body.textContent || '').split(/\n\s*\n/)) {
                const text = chunk.replace(/\s+/g, ' ').trim();
                if (text) blocks.push({ type: 'p', text });
            }
        }
    }
    return finishText(file, title, blocks, onProgress);
}

/* ------------------------- shared helpers ------------------------ */

async function finishText(file: File, title: string, blocks: Block[], onProgress: ProgressFn): Promise<BookDoc> {
    if (!blocks.some((b) => b.type === 'p')) throw new Error('No readable text was found in this file.');
    onProgress('Making pages…', 0);
    const pages = await paginate(blocks, (f) => onProgress('Making pages…', f));
    return { id: ++counter, key: keyOf(file), kind: 'text', title, pageCount: pages.length, pages };
}

const pdfWords = new WeakMap<object, Map<number, number>>();

/** Number of words on a page; used to time auto-flipping. PDF pages are counted lazily and cached. */
export async function getPageWords(doc: BookDoc, index: number): Promise<number> {
    if (doc.kind === 'text') return doc.pages[index]?.words ?? 0;

    const item = doc.items[index];
    if (!item || item.type !== 'pdf') return 0; // pictures have no words

    let cache = pdfWords.get(item.src.pdf);
    if (!cache) {
        cache = new Map();
        pdfWords.set(item.src.pdf, cache);
    }
    const hit = cache.get(item.index);
    if (hit !== undefined) return hit;

    const page = await item.src.pdf.getPage(item.index + 1);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ('str' in it ? it.str : '')).join(' ');
    const count = text.split(/\s+/).filter(Boolean).length;
    cache.set(item.index, count);
    return count;
}
