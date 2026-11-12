import type { ImageEdit, ImageItem, ImageSource, Overlay, PageItem, PagesDoc, PdfItem, PdfSource, Source } from './types';

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const defaultEdit = (): ImageEdit => ({
    rotate: 0,
    flipH: false,
    flipV: false,
    straighten: 0,
    crop: null,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    sharpen: 0,
    filter: 'none',
});

export const isDefaultEdit = (e: ImageEdit) => JSON.stringify(e) === JSON.stringify(defaultEdit());

export const imageItem = (src: ImageSource, edit: ImageEdit = defaultEdit()): ImageItem => ({
    id: newId(),
    type: 'image',
    src,
    edit,
    overlays: [],
});

export const pdfItems = (src: PdfSource): PdfItem[] =>
    Array.from({ length: src.pageCount }, (_, index) => ({ id: newId(), type: 'pdf' as const, src, index, overlays: [] }));

/** height / width of a page as it will be shown */
export function itemRatio(item: PageItem): number {
    if (item.type === 'pdf') return item.src.ratio || 1.414;
    let w = item.src.width;
    let h = item.src.height;
    if (item.edit.rotate % 180 !== 0) [w, h] = [h, w];
    if (item.edit.crop) {
        w *= item.edit.crop.w;
        h *= item.edit.crop.h;
    }
    return h / Math.max(1, w);
}

export const docRatio = (items: PageItem[]) => (items.length ? itemRatio(items[0]) : 1.414);

export const sourcesOf = (items: PageItem[]): Source[] => {
    const seen = new Map<string, Source>();
    items.forEach((it) => seen.set(it.src.id, it.src));
    return Array.from(seen.values());
};

/** A new version of the document with a different page list. */
export function withItems(doc: PagesDoc, items: PageItem[], extraSources: Source[] = []): PagesDoc {
    const known = new Set(doc.sources.map((s) => s.id));
    const sources = [...doc.sources, ...extraSources.filter((s) => !known.has(s.id))];
    return { ...doc, items, sources, pageCount: items.length, ratio: docRatio(items), rev: doc.rev + 1 };
}

export const removeAt = (items: PageItem[], i: number) => items.filter((_, k) => k !== i);

export function moveItem(items: PageItem[], i: number, dir: -1 | 1): PageItem[] {
    const j = i + dir;
    if (j < 0 || j >= items.length) return items;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}

export function insertAt(items: PageItem[], at: number, add: PageItem[]): PageItem[] {
    const next = items.slice();
    next.splice(Math.min(Math.max(0, at), next.length), 0, ...add);
    return next;
}

/** Copy of a page with its own id (images keep sharing the same stored picture). */
const copyOverlays = (list: Overlay[]): Overlay[] => list.map((o) => ({ ...o, id: newId() }));

export const duplicateItem = (item: PageItem): PageItem =>
    item.type === 'image'
        ? { ...item, id: newId(), edit: { ...item.edit }, overlays: copyOverlays(item.overlays) }
        : { ...item, id: newId(), overlays: copyOverlays(item.overlays) };
