import { getBitmap, renderEdit } from './imageops';
import { drawOverlays } from './overlays';
import type { PageItem } from './types';

/** Runs thumbnail jobs a few at a time. */
const LIMIT = 3;
let running = 0;
const waiting: (() => void)[] = [];

function slot(): Promise<() => void> {
    return new Promise((resolve) => {
        const go = () => {
            running++;
            resolve(() => {
                running--;
                waiting.shift()?.();
            });
        };
        if (running < LIMIT) go();
        else waiting.push(go);
    });
}

/** Draws a small picture of a page into `canvas` (longest side `size` css pixels). */
export async function drawThumb(item: PageItem, canvas: HTMLCanvasElement, size: number, isCancelled: () => boolean) {
    const release = await slot();
    try {
        if (isCancelled()) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const px = Math.round(size * dpr);
        let out: HTMLCanvasElement;
        if (item.type === 'image') {
            out = renderEdit(await getBitmap(item.src), item.edit, px);
        } else {
            const page = await item.src.pdf.getPage(item.index + 1);
            const base = page.getViewport({ scale: 1 });
            const vp = page.getViewport({ scale: px / Math.max(base.width, base.height) });
            out = document.createElement('canvas');
            out.width = Math.max(1, Math.floor(vp.width));
            out.height = Math.max(1, Math.floor(vp.height));
            const ctx = out.getContext('2d');
            if (!ctx) return;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, out.width, out.height);
            await page.render({ canvasContext: ctx, canvas: out, viewport: vp } as any).promise;
            page.cleanup();
        }
        if (isCancelled()) return;
        canvas.width = out.width;
        canvas.height = out.height;
        canvas.style.aspectRatio = `${out.width} / ${out.height}`;
        const tctx = canvas.getContext('2d');
        tctx?.drawImage(out, 0, 0);
        if (tctx && item.overlays.length) await drawOverlays(tctx, canvas.width, canvas.height, item.overlays);
    } catch {
        /* a thumbnail that cannot be drawn just stays blank */
    } finally {
        release();
    }
}

/** Renders a PDF page to a JPEG picture (used to turn a PDF page into an editable image). */
export async function pdfPageToBlob(item: Extract<PageItem, { type: 'pdf' }>, longSide = 2000): Promise<{ blob: Blob; width: number; height: number }> {
    const page = await item.src.pdf.getPage(item.index + 1);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: longSide / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport: vp } as any).promise;
    page.cleanup();
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not render the page.'))), 'image/jpeg', 0.92));
    return { blob, width: canvas.width, height: canvas.height };
}
