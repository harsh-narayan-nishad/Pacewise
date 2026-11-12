'use client';

import React, { useEffect, useRef, useState } from 'react';

import { drawOverlays } from '@/lib/flipreader/overlays';
import type { Overlay } from '@/lib/flipreader/types';

const MAX_SIDE = 4096;

/**
 * Pictures and text placed on a page, drawn onto one canvas that covers the page exactly.
 * It sizes itself to the page it sits on, so it works in the book, in the editor and when zoomed.
 */
export function OverlayLayer({ overlays, quality = 1, skipId = null }: { overlays: Overlay[]; quality?: number; skipId?: string | null }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || !size.w || !size.h) return undefined;
        let cancelled = false;
        const dpr = Math.min(window.devicePixelRatio || 1, 2) * Math.max(1, quality);
        const k = Math.min(dpr, MAX_SIDE / Math.max(size.w, size.h));
        const w = Math.max(1, Math.round(size.w * k));
        const h = Math.max(1, Math.round(size.h * k));
        // draw off screen first, so the page never flashes empty while a picture is still being decoded
        const buffer = document.createElement('canvas');
        buffer.width = w;
        buffer.height = h;
        const bctx = buffer.getContext('2d');
        if (!bctx) return undefined;
        void drawOverlays(bctx, w, h, overlays, skipId)
            .then(() => {
                if (cancelled) return;
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d')?.drawImage(buffer, 0, 0);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [overlays, size.w, size.h, quality, skipId]);

    return <canvas ref={ref} className="rd-overlay" aria-hidden="true" />;
}
