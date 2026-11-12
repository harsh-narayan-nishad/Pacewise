import { getBitmap, MAX_IMPORT_SIDE, renderEdit, toBlob } from './imageops';
import { drawOverlays } from './overlays';
import type { Overlay, PagesDoc } from './types';

const LONG_SIDE_PT = 842; // an A4 sheet's long side, in PDF points

/**
 * Builds one PDF from all pages of the book, in order: pages of PDF files are copied as they are
 * (text stays selectable), pictures are exported with their edits applied.
 * pdf-lib is only downloaded when this is used.
 */
export async function exportMergedPdf(
    doc: PagesDoc,
    onProgress: (done: number, total: number) => void
): Promise<Blob> {
    const { PDFDocument, degrees } = await import('pdf-lib');
    const out = await PDFDocument.create();
    const opened = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();
    const total = doc.items.length;

    for (let i = 0; i < total; i++) {
        const item = doc.items[i];
        if (item.type === 'pdf') {
            let source = opened.get(item.src.id);
            if (!source) {
                source = await PDFDocument.load(await item.src.file.arrayBuffer(), { ignoreEncryption: true });
                opened.set(item.src.id, source);
            }
            const [page] = await out.copyPages(source, [item.index]);
            out.addPage(page);
            if (item.overlays.length) await stampOverlays(out, page, item.overlays, degrees);
        } else {
            // the picture with its edits, and anything placed on it, as one image
            const canvas = renderEdit(await getBitmap(item.src), item.edit, MAX_IMPORT_SIDE);
            if (item.overlays.length) await drawOverlays(canvas.getContext('2d')!, canvas.width, canvas.height, item.overlays);
            const blob = await toBlob(canvas, 'image/jpeg', 0.92);
            const { width, height } = canvas;
            const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
            const k = LONG_SIDE_PT / Math.max(width, height);
            const page = out.addPage([width * k, height * k]);
            page.drawImage(image, { x: 0, y: 0, width: width * k, height: height * k });
        }
        onProgress(i + 1, total);
        if (i % 4 === 3) await new Promise((r) => setTimeout(r)); // let the progress bar paint
    }

    out.setTitle(doc.title);
    out.setProducer('Flip reader');
    const bytes = await out.save();
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/**
 * Puts everything placed on a PDF page on top of it, as one transparent picture the size of the page.
 * (Text boxes become part of that picture, so any language prints exactly as it looks, but is not selectable.)
 */
async function stampOverlays(
    out: { embedPng(bytes: Uint8Array): Promise<unknown> },
    page: {
        getRotation(): { angle: number };
        getMediaBox(): { x: number; y: number; width: number; height: number };
        drawImage(image: never, options: Record<string, unknown>): void;
    },
    overlays: Overlay[],
    degrees: (n: number) => unknown
) {
    const mb = page.getMediaBox();
    const rot = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    // the size of the page as a reader sees it (a turned page swaps width and height)
    const dw = rot % 180 === 0 ? mb.width : mb.height;
    const dh = rot % 180 === 0 ? mb.height : mb.width;
    const k = Math.min(3, 2400 / Math.max(dw, dh)); // pixels per point
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(dw * k));
    canvas.height = Math.max(1, Math.round(dh * k));
    await drawOverlays(canvas.getContext('2d')!, canvas.width, canvas.height, overlays);
    const png = await toBlob(canvas, 'image/png', 1);
    const image = (await out.embedPng(new Uint8Array(await png.arrayBuffer()))) as never;

    const at =
        rot === 0
            ? { x: mb.x, y: mb.y, rotate: degrees(0) }
            : rot === 90
              ? { x: mb.x + mb.width, y: mb.y, rotate: degrees(90) }
              : rot === 180
                ? { x: mb.x + mb.width, y: mb.y + mb.height, rotate: degrees(180) }
                : { x: mb.x, y: mb.y + mb.height, rotate: degrees(270) };
    page.drawImage(image, { ...at, width: dw, height: dh });
}

/** Saves a blob as a file download. */
export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/[\\/:*?"<>|]+/g, '_');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
