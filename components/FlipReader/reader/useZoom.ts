'use client';

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

interface Z {
    s: number; // scale
    x: number; // pan in px, relative to the centre of the box
    y: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/**
 * Pinch-to-zoom (two fingers), drag-to-pan while zoomed, and Ctrl + wheel / trackpad pinch on desktop.
 *
 * While a gesture is in progress the transform is written straight to the DOM (no React renders at 60 fps).
 * `scale` is the committed value, updated when the gesture ends.
 */
export function useZoom(boxRef: RefObject<HTMLDivElement | null>, targetRef: RefObject<HTMLDivElement | null>) {
    const cur = useRef<Z>({ s: 1, x: 0, y: 0 });
    const [scale, setScale] = useState(1);

    const write = useCallback(() => {
        const el = targetRef.current;
        if (!el) return;
        const { s, x, y } = cur.current;
        el.style.transform = s === 1 && x === 0 && y === 0 ? '' : `translate(${x}px, ${y}px) scale(${s})`;
    }, [targetRef]);

    /** Zoom in (factor > 1) or out (< 1) around the middle of the page, for buttons. */
    const zoomBy = useCallback(
        (factor: number) => {
            const box = boxRef.current;
            if (!box) return;
            const r = box.getBoundingClientRect();
            const z = cur.current;
            const ns = clamp(z.s * factor, MIN_ZOOM, MAX_ZOOM);
            const qx = -z.x / z.s;
            const qy = -z.y / z.s;
            const mx = ((ns - 1) * r.width) / 2;
            const my = ((ns - 1) * r.height) / 2;
            cur.current = ns < 1.05 ? { s: 1, x: 0, y: 0 } : { s: ns, x: clamp(-ns * qx, -mx, mx), y: clamp(-ns * qy, -my, my) };
            write();
            setScale(cur.current.s);
        },
        [boxRef, write]
    );

    const reset = useCallback(() => {
        cur.current = { s: 1, x: 0, y: 0 };
        write();
        setScale(1);
    }, [write]);

    useEffect(() => {
        const box = boxRef.current;
        if (!box) return undefined;

        const pts = new Map<number, { x: number; y: number }>();
        let pinch: { d0: number; s0: number; cx0: number; cy0: number; x0: number; y0: number } | null = null;
        let pan: { id: number; px: number; py: number; x0: number; y0: number; moved: boolean } | null = null;
        let commitTimer: ReturnType<typeof setTimeout> | null = null;

        const center = () => {
            const r = box.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
        };

        const clampPan = () => {
            const c = center();
            const z = cur.current;
            const mx = ((z.s - 1) * c.w) / 2;
            const my = ((z.s - 1) * c.h) / 2;
            z.x = clamp(z.x, -mx, mx);
            z.y = clamp(z.y, -my, my);
        };

        const commit = () => {
            if (commitTimer) clearTimeout(commitTimer);
            commitTimer = null;
            if (cur.current.s < 1.05) cur.current = { s: 1, x: 0, y: 0 }; // snap back to normal
            write();
            setScale(cur.current.s);
        };

        /** Zoom to `s` keeping the content under screen point (px, py) in place. */
        const zoomAt = (px: number, py: number, s: number) => {
            const c = center();
            const z = cur.current;
            const ns = clamp(s, MIN_ZOOM, MAX_ZOOM);
            const qx = (px - c.x - z.x) / z.s;
            const qy = (py - c.y - z.y) / z.s;
            z.s = ns;
            z.x = px - c.x - ns * qx;
            z.y = py - c.y - ns * qy;
            clampPan();
            write();
        };

        const startPinch = () => {
            const [a, b] = Array.from(pts.values());
            const c = center();
            pinch = {
                d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
                s0: cur.current.s,
                cx0: (a.x + b.x) / 2 - c.x,
                cy0: (a.y + b.y) / 2 - c.y,
                x0: cur.current.x,
                y0: cur.current.y,
            };
            pan = null;
        };

        const onDown = (e: PointerEvent) => {
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.size === 2) startPinch();
            else if (pts.size === 1 && cur.current.s > 1.01 && (e.pointerType !== 'mouse' || e.button === 0)) {
                pan = { id: e.pointerId, px: e.clientX, py: e.clientY, x0: cur.current.x, y0: cur.current.y, moved: false };
            }
        };

        const onMove = (e: PointerEvent) => {
            if (!pts.has(e.pointerId)) return;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (pinch && pts.size >= 2) {
                const [a, b] = Array.from(pts.values());
                const c = center();
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                const ns = clamp(pinch.s0 * (d / pinch.d0), MIN_ZOOM, MAX_ZOOM);
                const cx = (a.x + b.x) / 2 - c.x;
                const cy = (a.y + b.y) / 2 - c.y;
                const qx = (pinch.cx0 - pinch.x0) / pinch.s0; // content point that was under the fingers
                const qy = (pinch.cy0 - pinch.y0) / pinch.s0;
                cur.current = { s: ns, x: cx - ns * qx, y: cy - ns * qy };
                clampPan();
                write();
                return;
            }

            if (pan && pan.id === e.pointerId) {
                const dx = e.clientX - pan.px;
                const dy = e.clientY - pan.py;
                if (!pan.moved && Math.hypot(dx, dy) < 4) return;
                if (!pan.moved) {
                    pan.moved = true;
                    try {
                        box.setPointerCapture(e.pointerId);
                    } catch {
                        /* ignore */
                    }
                }
                cur.current.x = pan.x0 + dx;
                cur.current.y = pan.y0 + dy;
                clampPan();
                write();
            }
        };

        const onUp = (e: PointerEvent) => {
            const had = pts.delete(e.pointerId);
            if (!had) return;
            if (pinch && pts.size < 2) {
                pinch = null;
                commit();
                // the remaining finger carries on as a pan
                const rest = Array.from(pts.entries())[0];
                if (rest && cur.current.s > 1.01) {
                    pan = { id: rest[0], px: rest[1].x, py: rest[1].y, x0: cur.current.x, y0: cur.current.y, moved: false };
                }
            }
            if (pan && pan.id === e.pointerId) pan = null;
        };

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                // trackpad pinch (and Ctrl + wheel) arrives as a wheel event with ctrlKey set
                e.preventDefault();
                zoomAt(e.clientX, e.clientY, cur.current.s * Math.exp(-e.deltaY * 0.0125));
                if (commitTimer) clearTimeout(commitTimer);
                commitTimer = setTimeout(commit, 160);
            } else if (cur.current.s > 1.01) {
                e.preventDefault();
                cur.current.x -= e.deltaX;
                cur.current.y -= e.deltaY;
                clampPan();
                write();
            }
        };

        // Safari (iOS and macOS) also fires its own gesture events for pinches: stop the page itself zooming
        const stop = (e: Event) => e.preventDefault();

        box.addEventListener('pointerdown', onDown);
        box.addEventListener('pointermove', onMove);
        box.addEventListener('pointerup', onUp);
        box.addEventListener('pointercancel', onUp);
        box.addEventListener('wheel', onWheel, { passive: false });
        box.addEventListener('gesturestart', stop);
        box.addEventListener('gesturechange', stop);
        return () => {
            if (commitTimer) clearTimeout(commitTimer);
            box.removeEventListener('pointerdown', onDown);
            box.removeEventListener('pointermove', onMove);
            box.removeEventListener('pointerup', onUp);
            box.removeEventListener('pointercancel', onUp);
            box.removeEventListener('wheel', onWheel);
            box.removeEventListener('gesturestart', stop);
            box.removeEventListener('gesturechange', stop);
        };
    }, [boxRef, write]);

    return { scale, reset, zoomBy };
}
