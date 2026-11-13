import { newId } from '@/lib/flipreader/pages';
import type { ImageSource } from '@/lib/flipreader/types';

/**
 * Draws an element exactly as it looks on screen into a picture: the element is copied with every computed style
 * written inline and its pictures turned into data URLs, wrapped in an SVG <foreignObject>, and drawn onto a canvas.
 * Used to put a page written in the rich text editor back onto a flip book page.
 */

const SKIP = new Set(['SCRIPT', 'NOSCRIPT', 'IFRAME']);

function inlineStyles(src: Element, dst: Element): void {
    const cs = getComputedStyle(src);
    const style = (dst as HTMLElement).style;
    if (style) {
        for (let i = 0; i < cs.length; i += 1) {
            const p = cs[i];
            style.setProperty(p, cs.getPropertyValue(p), cs.getPropertyPriority(p));
        }
        // the copy must not keep editing UI
        style.setProperty('caret-color', 'transparent');
        style.setProperty('outline', 'none');
    }
    const a = src.children;
    const b = dst.children;
    for (let i = 0; i < a.length && i < b.length; i += 1) inlineStyles(a[i], b[i]);
}

async function toDataUrl(url: string): Promise<string> {
    if (url.startsWith('data:')) return url;
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}

/**
 * Renders `el` into pictures of `pageW` x `pageH` pixels on a `background` page, as many pages as its content needs:
 * the element is scaled to the page width; when it is longer than one page it is split into pages, breaking between
 * its blocks (paragraphs, headings, code blocks ...) so no line is cut in half, and every following page starts
 * with the same top margin as the first. A single block taller than a page is cut where the page ends.
 */
export async function elementToPageImages(
    el: HTMLElement,
    pageW: number,
    pageH: number,
    background: string,
    name: string,
    /** when the element is already laid out as separate sheets (document mode), cut exactly along them */
    sheets?: { height: number; gap: number; count: number }
): Promise<ImageSource[]> {
    const w = Math.max(1, el.offsetWidth);
    const copy = el.cloneNode(true) as HTMLElement;
    inlineStyles(el, copy);
    copy.querySelectorAll('*').forEach((n) => {
        if (SKIP.has(n.tagName)) n.remove();
    });
    // editing controls are not part of the page: the code blocks' toolbars and find bars, and the shadow
    // and page-break guides that mark the page on screen
    // "Add a header" / "Add a footer" prompts: invisible on the page, keeping their place so nothing moves
    copy.querySelectorAll<HTMLElement>('.pe-hint').forEach((n) => n.style.setProperty('visibility', 'hidden'));
    if (sheets) {
        // the layout must not move: the toolbars become invisible instead of being taken out
        copy.querySelectorAll<HTMLElement>('.sr-code-head, .sr-code-find').forEach((n) => n.style.setProperty('visibility', 'hidden'));
        copy.querySelectorAll('.sr-code-input, .sr-code-line-hl').forEach((n) => n.remove());
    } else {
        copy.querySelectorAll('.sr-code-head, .sr-code-find, .sr-code-input, .sr-code-line-hl').forEach((n) => n.remove());
        copy.querySelectorAll<HTMLElement>('.sr-code-widget').forEach((n) => n.style.setProperty('height', 'auto'));
        copy.style.setProperty('min-height', '0');
        copy.style.setProperty('height', 'auto');
    }
    copy.style.setProperty('box-shadow', 'none');
    copy.style.setProperty('background-image', 'none');
    copy.removeAttribute('contenteditable');
    copy.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    copy.style.setProperty('margin', '0');
    copy.style.setProperty('width', `${w}px`);
    copy.style.setProperty('max-width', 'none');
    copy.style.setProperty('zoom', '1');
    copy.style.setProperty('transform', 'none');
    copy.style.setProperty('position', 'relative');
    // pictures inside an SVG image must be data URLs
    await Promise.all(
        Array.from(copy.querySelectorAll('img')).map(async (img) => {
            try {
                img.setAttribute('src', await toDataUrl(img.currentSrc || img.src));
            } catch {
                img.remove();
            }
        })
    );

    // Measure the copy as it will be drawn: its height and where each block ends.
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;';
    host.appendChild(copy);
    document.body.appendChild(host);
    const top = copy.getBoundingClientRect().top;
    const blocks = Array.from(copy.querySelectorAll<HTMLElement>('.sr-surface > *')).map((b) => {
        const r = b.getBoundingClientRect();
        const m = getComputedStyle(b);
        return { top: r.top - top - parseFloat(m.marginTop || '0'), bottom: r.bottom - top };
    });
    const cs = getComputedStyle(copy);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const h = Math.max(1, copy.scrollHeight);
    host.remove();

    const xhtml = new XMLSerializer().serializeToString(copy);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('The document could not be turned into a page.'));
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });

    // Where each page starts and ends, in the element's pixels.
    const pagePx = w * (pageH / pageW);
    const slices: Array<{ from: number; to: number }> = sheets
        ? Array.from({ length: sheets.count }, (_, i) => ({ from: i * (sheets.height + sheets.gap), to: i * (sheets.height + sheets.gap) + sheets.height }))
        : [];
    let from = 0;
    while (!sheets && from < h - padBottom - 1 && slices.length < 200) {
        const room = from === 0 ? pagePx - padBottom : pagePx - padTop - padBottom;
        const limit = from + room;
        if (limit >= h - padBottom) {
            slices.push({ from, to: h });
            break;
        }
        // the last block that still fits whole; if none does, cut at the limit
        const fits = blocks.filter((b) => b.bottom <= limit && b.bottom > from + 1);
        let to = fits.length ? fits[fits.length - 1].bottom : limit;
        if (to - from < room * 0.25) to = limit; // a nearly empty page: cut the big block instead
        slices.push({ from, to });
        // the next page starts at the next block's top (skipping the gap between blocks)
        const next = blocks.find((b) => b.top >= to - 1);
        from = next && next.top < to + room ? Math.max(to, next.top) : to;
    }

    const k = pageW / w;
    const out: ImageSource[] = [];
    for (let i = 0; i < slices.length; i += 1) {
        const { from: a, to: b } = slices[i];
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(pageW);
        canvas.height = Math.round(pageH);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const dy = i === 0 || sheets ? 0 : padTop * k;
        const sh = Math.min(b, h) - a;
        if (sh > 0) ctx.drawImage(img, 0, a, w, sh, 0, dy, canvas.width, sh * k);
        const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((x) => (x ? resolve(x) : reject(new Error('The page picture could not be made.'))), 'image/png'));
        out.push({ id: newId(), kind: 'image', name: slices.length > 1 ? `${name} (${i + 1})` : name, blob, width: canvas.width, height: canvas.height });
    }
    return out;
}
