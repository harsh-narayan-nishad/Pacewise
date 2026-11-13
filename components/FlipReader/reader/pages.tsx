'use client';

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { OverlayLayer } from './OverlayLayer';
import { MediconnectSpinner } from '@/components/ui/loaders/MediconnectSpinner';

import { useFlipPageSize } from '@/components/FlipReader/flip-book';
import { getBitmap, renderEdit } from '@/lib/flipreader/imageops';
import { findOccurrence, normalizeItems, RawItem, rectsForRange } from '@/lib/flipreader/pdftext';
import { H_STYLE, PAGE_STYLE, P_STYLE } from '@/lib/flipreader/paginate';
import { ImageItem, Overlay, TEXT_PAGE, TextPageData } from '@/lib/flipreader/types';

/** Which match to highlight on a page: the n-th occurrence of `q` (folded, lower case). */
export interface HighlightTarget {
    q: string;
    occurrence: number;
    /** changes for every new request, so the highlight animation replays */
    token: number;
}

interface CssRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const NO_OVERLAYS: Overlay[] = [];
const MAX_SIDE = 4096; // largest canvas side, in device pixels
const MAX_PIXELS = 16_000_000;

/**
 * A PDF page. The canvas is only drawn while `active` (close to the page being read) and is released
 * again when the reader moves away, so memory stays flat for long PDFs. `quality` > 1 re-draws the page
 * sharper while the reader is zoomed in. If `highlight` is set, the match is marked on top of the page.
 */
export const PdfPage = memo(function PdfPage({
    pdf,
    index,
    active,
    quality = 1,
    highlight = null,
    dark = false,
    overlays = NO_OVERLAYS,
}: {
    pdf: PDFDocumentProxy;
    index: number;
    active: boolean;
    quality?: number;
    highlight?: HighlightTarget | null;
    overlays?: Overlay[];
    /** night mode with inverted PDF pages */
    dark?: boolean;
}) {
    const { W, H } = useFlipPageSize();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const info = useRef<{ transform: number[]; scale: number; cssScale: number } | null>(null);
    const [renderTick, setRenderTick] = useState(0);
    const [rects, setRects] = useState<CssRect[]>([]);
    const [drawn, setDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        if (!active) {
            canvas.width = 0;
            canvas.height = 0;
            info.current = null;
            return undefined;
        }

        let cancelled = false;
        let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
        setDrawn(false);

        (async () => {
            try {
                const page = await pdf.getPage(index + 1);
                if (cancelled) return;

                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const base = page.getViewport({ scale: 1 });
                const fit = Math.min(W / base.width, H / base.height); // css pixels per PDF unit
                let scale = fit * dpr * Math.max(1, quality);

                // keep the canvas within what browsers can handle
                const w0 = base.width * scale;
                const h0 = base.height * scale;
                scale *= Math.min(1, MAX_SIDE / Math.max(w0, h0), Math.sqrt(MAX_PIXELS / (w0 * h0)));

                const viewport = page.getViewport({ scale });
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = `${base.width * fit}px`;
                canvas.style.height = `${base.height * fit}px`;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                // `canvas` is required by newer pdf.js versions, `canvasContext` by older ones
                task = page.render({ canvasContext: ctx, canvas, viewport } as any);
                await task!.promise;
                if (cancelled) return;
                info.current = { transform: viewport.transform, scale: viewport.scale, cssScale: scale / fit };
                setDrawn(true);
                setRenderTick((t) => t + 1);
            } catch (err) {
                // a cancelled render (the reader moved on) is expected; anything else is worth knowing
                const name = (err as { name?: string } | null)?.name;
                if (name !== 'RenderingCancelledException' && !cancelled) console.error('PDF page render failed', err);
            }
        })();

        return () => {
            cancelled = true;
            task?.cancel();
        };
    }, [pdf, index, active, W, H, quality]);

    // mark the search match once the page is drawn
    useEffect(() => {
        const i = info.current;
        if (!highlight || !active || !i) {
            setRects([]);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            const page = await pdf.getPage(index + 1);
            const content = await page.getTextContent();
            if (cancelled) return;
            const items = content.items as RawItem[];
            const { text, map } = normalizeItems(items, true);
            const at = findOccurrence(text, highlight.q, highlight.occurrence);
            if (at < 0 || !map) {
                setRects([]);
                return;
            }
            const found = rectsForRange(items, map, at, at + highlight.q.length, i.transform, i.scale);
            setRects(found.map((r) => ({ x: r.x / i.cssScale, y: r.y / i.cssScale, w: r.w / i.cssScale, h: r.h / i.cssScale })));
        })().catch(() => {
            if (!cancelled) setRects([]);
        });
        return () => {
            cancelled = true;
        };
    }, [highlight, renderTick, active, pdf, index]);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: dark ? '#111314' : '#fff',
                position: 'relative',
            }}
        >
            {/* while the page is being drawn: Mediconnect's blade loader in the page itself, not a blank page */}
            {active && !drawn && (
                <div className="rd-page-loader" aria-hidden="true">
                    <MediconnectSpinner label="Loading page" />
                </div>
            )}
            <div style={{ position: 'relative', lineHeight: 0 }}>
                <canvas ref={canvasRef} style={{ display: 'block', filter: dark ? 'invert(0.92) hue-rotate(180deg)' : undefined }} />
                {overlays.length > 0 && <OverlayLayer overlays={overlays} quality={quality} />}
                {rects.map((r, k) => (
                    <div
                        key={`${highlight?.token}-${k}`}
                        className="rd-hl"
                        data-night={dark}
                        style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                    />
                ))}
            </div>
        </div>
    );
});

/** Splits each block into [before, match, after] around the n-th occurrence of the highlight, or null. */
function markBlocks(blocks: TextPageData['blocks'], h: HighlightTarget): ([string, string, string] | null)[] | null {
    const joined = blocks.map((b) => b.text).join(' ');
    const at = findOccurrence(joined, h.q, h.occurrence);
    if (at < 0) return null;
    const end = at + h.q.length;

    let offset = 0;
    return blocks.map((b) => {
        const from = Math.max(at, offset) - offset;
        const to = Math.min(end, offset + b.text.length) - offset;
        offset += b.text.length + 1;
        if (to <= from) return null;
        return [b.text.slice(0, from), b.text.slice(from, to), b.text.slice(to)] as [string, string, string];
    });
}

/** A page of reflowed text (TXT / EPUB), drawn at a fixed virtual size and scaled to fit. */
export const TextPage = memo(function TextPage({
    data,
    index,
    highlight = null,
    night = false,
}: {
    data: TextPageData;
    index: number;
    highlight?: HighlightTarget | null;
    night?: boolean;
}) {
    const { W } = useFlipPageSize();
    const scale = W / TEXT_PAGE.w;
    // a page that only holds the book title is shown centred, like a title page
    const isTitle = index === 0 && data.blocks.length === 1 && data.blocks[0].type === 'h';
    const marks = useMemo(() => (highlight ? markBlocks(data.blocks, highlight) : null), [data, highlight]);

    const content = (b: TextPageData['blocks'][number], i: number) => {
        const m = marks?.[i];
        return m ? (
            <>
                {m[0]}
                <mark key={highlight?.token} className="rd-hl-text" data-night={night}>
                    {m[1]}
                </mark>
                {m[2]}
            </>
        ) : (
            b.text
        );
    };

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            <div
                style={{
                    width: TEXT_PAGE.w,
                    height: TEXT_PAGE.h,
                    padding: `${TEXT_PAGE.padY}px ${TEXT_PAGE.padX}px`,
                    position: 'relative',
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                }}
            >
                <div
                    style={{
                        ...(isTitle
                            ? { ...PAGE_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }
                            : PAGE_STYLE),
                        color: night ? '#dedbd3' : PAGE_STYLE.color,
                    }}
                >
                    {data.blocks.map((b, i) =>
                        b.type === 'h' ? (
                            <h2 key={i} style={isTitle ? { ...H_STYLE, margin: 0, fontSize: '38px' } : H_STYLE}>
                                {content(b, i)}
                            </h2>
                        ) : (
                            <p key={i} style={P_STYLE}>
                                {content(b, i)}
                            </p>
                        )
                    )}
                </div>
                <div
                    style={{
                        position: 'absolute',
                        bottom: 22,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        fontSize: 13,
                        opacity: 0.5,
                        fontFamily: 'system-ui, sans-serif',
                        color: night ? '#8f8c85' : '#2b2a28',
                    }}
                >
                    {index + 1}
                </div>
            </div>
        </div>
    );
});

/**
 * A picture page. The edit (crop, rotation, colour...) is applied when the page is drawn, and the result
 * is only kept while the page is near the one being read.
 */
export const ImagePage = memo(function ImagePage({
    item,
    active,
    quality = 1,
    night = false,
}: {
    item: ImageItem;
    active: boolean;
    quality?: number;
    night?: boolean;
}) {
    const overlays = item.overlays;
    const { W, H } = useFlipPageSize();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [drawn, setDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        setDrawn(false);
        if (!active) {
            canvas.width = 0;
            canvas.height = 0;
            return undefined;
        }

        let cancelled = false;
        (async () => {
            try {
                const bitmap = await getBitmap(item.src);
                if (cancelled) return;
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const target = Math.min(MAX_SIDE, Math.max(W, H) * dpr * Math.max(1, quality));
                const out = renderEdit(bitmap, item.edit, target);
                if (cancelled) return;

                canvas.width = out.width;
                canvas.height = out.height;
                canvas.getContext('2d')?.drawImage(out, 0, 0);
                // show it as large as fits inside the page, keeping its shape
                const k = Math.min(W / out.width, H / out.height);
                canvas.style.width = `${out.width * k}px`;
                canvas.style.height = `${out.height * k}px`;
                setDrawn(true);
            } catch (err) {
                if (!cancelled) console.error('Image page failed', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [item.src, item.edit, active, W, H, quality]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: night ? '#0f1112' : '#f7f4ee' }}>
            {/* while the picture is being drawn: Mediconnect's blade loader in the page itself, not a blank page */}
            {active && !drawn && (
                <div className="rd-page-loader" aria-hidden="true">
                    <MediconnectSpinner label="Loading page" />
                </div>
            )}
            <div style={{ position: 'relative', lineHeight: 0 }}>
                <canvas ref={canvasRef} style={{ display: 'block', filter: night ? 'brightness(0.86)' : undefined }} />
                {overlays.length > 0 && <OverlayLayer overlays={overlays} quality={quality} />}
            </div>
        </div>
    );
});

/** A page hidden in the page editor: it keeps its place in the book but shows only that it is hidden. */
export const HiddenPage = memo(function HiddenPage({ night = false }: { night?: boolean }) {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: night ? '#0f1112' : '#f7f4ee', color: night ? '#8a8d93' : '#8a8478', font: '14px/1.4 Inter, system-ui, sans-serif' }}>
            Hidden page
        </div>
    );
});
