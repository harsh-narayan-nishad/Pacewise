'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

/*
 * Liquid glass, modelled on Apple's material:
 *
 *  - LENS: the content behind is bent at the rim like light through a thick pane of glass with a rounded
 *    (convex squircle) edge. The bend at every pixel of the rim comes from Snell's law (n = 1.5) applied to the
 *    slope of that edge profile, and is delivered as an SVG displacement map. Browsers that can run SVG filters
 *    on a backdrop (Chrome, Edge, Android Chrome) show it. Like the Pacewise navbar, the red, green and blue channels
 *    are bent by slightly different amounts, which gives the liquid colour fringe along the rim. Safari and Firefox get the same material without the
 *    bend: blurred, saturated and lit.
 *  - LIGHT: a bright specular rim that is strongest top-left and bottom-right, and a soft inner glow.
 *  - COLOUR: the backdrop is slightly blurred and over-saturated, then tinted by the theme (see --glass-* in
 *    globals.css), so the same surface works in day and night mode.
 */

export interface LiquidGlassProps {
    children?: React.ReactNode;
    width?: number | string;
    height?: number | string;
    /** corner radius in px */
    radius?: number;
    /** width in px of the curved edge that bends the light (default: about a third of the shorter side, max 24) */
    bezel?: number;
    /** how strongly the edge bends the light, 0 to 2 (default 1) */
    strength?: number;
    /** blur of the backdrop in px */
    blur?: number;
    saturation?: number;
    className?: string;
    style?: React.CSSProperties;
}

/* ------------------------------------------------------------------ *
 *  The displacement map
 * ------------------------------------------------------------------ */

const GLASS_INDEX = 1.5;
const MAX_MAP_PIXELS = 320_000;

/**
 * How far the light is shifted at each depth into the curved edge (0 = flat middle, 1 = the very rim),
 * for a convex squircle profile  h(t) = (1 - (1 - t)^4)^(1/4).
 */
const THICKNESS = 5; // how tall the glass is compared with the width of its curved edge
function edgeProfile(): Float32Array {
    const n = 256;
    const out = new Float32Array(n);
    let max = 0;
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const u = 1 - t;
        // slope of the surface: steep at the rim, flat at the top of the curve
        const slope = THICKNESS * (u ** 3) * Math.pow(Math.max(1e-6, 1 - u ** 4), -0.75);
        const theta1 = Math.atan(Math.min(slope, 6)); // the ray meets the surface at this angle
        const theta2 = Math.asin(Math.sin(theta1) / GLASS_INDEX); // and bends to this one inside the glass
        out[i] = Math.tan(theta1) - Math.tan(theta2);
        if (out[i] > max) max = out[i];
    }
    for (let i = 0; i < n; i++) out[i] /= max || 1;
    return out;
}
const PROFILE = edgeProfile();

/** Red and green encode where to look: 0.5 = here, away from 0.5 = shifted. Inside the edge there is no bend. */
function buildLensMap(w: number, h: number, radius: number, bezel: number, strength: number): { url: string; scale: number } | null {
    const k = Math.min(1, Math.sqrt(MAX_MAP_PIXELS / Math.max(1, w * h)));
    const mw = Math.max(2, Math.round(w * k));
    const mh = Math.max(2, Math.round(h * k));
    const canvas = document.createElement('canvas');
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(mw, mh);
    const d = img.data;

    const r = Math.min(radius, w / 2, h / 2);
    const B = Math.max(2, Math.min(bezel, Math.min(w, h) / 2));
    const hx = w / 2 - r;
    const hy = h / 2 - r;

    for (let y = 0; y < mh; y++) {
        const py = (y + 0.5) / k - h / 2;
        for (let x = 0; x < mw; x++) {
            const px = (x + 0.5) / k - w / 2;
            const i = (y * mw + x) * 4;

            // distance to the rounded rectangle's edge (negative inside) and the outward direction
            const qx = Math.abs(px) - hx;
            const qy = Math.abs(py) - hy;
            const ox = Math.max(qx, 0);
            const oy = Math.max(qy, 0);
            const outside = Math.hypot(ox, oy);
            const sdf = outside + Math.min(Math.max(qx, qy), 0) - r;
            const depth = -sdf;

            let vx = 0;
            let vy = 0;
            if (depth > 0 && depth < B) {
                const mag = PROFILE[Math.round((depth / B) * 255)];
                let nx: number;
                let ny: number;
                if (qx > 0 && qy > 0) {
                    nx = Math.sign(px) * (qx / outside);
                    ny = Math.sign(py) * (qy / outside);
                } else if (qx > qy) {
                    nx = Math.sign(px);
                    ny = 0;
                } else {
                    nx = 0;
                    ny = Math.sign(py);
                }
                vx = -nx * mag; // look inward: the picture there is always available
                vy = -ny * mag;
            }
            d[i] = 127.5 + 127.5 * vx;
            d[i + 1] = 127.5 + 127.5 * vy;
            d[i + 2] = 127.5;
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return { url: canvas.toDataURL('image/png'), scale: 2 * B * strength };
}

/** Chrome, Edge and Android Chrome can run an SVG filter on a backdrop; Safari and Firefox cannot. */
const canRefract = () => typeof navigator !== 'undefined' && /(Chrome|Chromium|Edg)\//.test(navigator.userAgent);

/* ------------------------------------------------------------------ *
 *  The component
 * ------------------------------------------------------------------ */

export default function LiquidGlass({
    children,
    width = 200,
    height = 80,
    radius = 24,
    bezel,
    strength = 1,
    blur = 5,
    saturation = 1.8,
    className = '',
    style,
}: LiquidGlassProps) {
    const id = `lg-${useId().replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const ref = useRef<HTMLDivElement>(null);
    const [refract, setRefract] = useState(false);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [map, setMap] = useState<{ url: string; scale: number } | null>(null);

    useEffect(() => setRefract(canRefract()), []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const bezelPx = bezel ?? Math.max(8, Math.min(24, Math.min(size.w, size.h) * 0.36));

    // the map is rebuilt once the size has settled, so animating the size stays smooth
    const first = useRef(true);
    useEffect(() => {
        if (!refract || !size.w || !size.h) return undefined;
        const t = setTimeout(
            () => {
                first.current = false;
                setMap(buildLensMap(size.w, size.h, radius, bezelPx, strength));
            },
            first.current ? 0 : 80
        );
        return () => clearTimeout(t);
    }, [refract, size.w, size.h, radius, bezelPx, strength]);

    const lens = refract && map;
    // The lens bends the backdrop first, then the browser's own backdrop blur softens it. (Blurring before the lens
    // leaves an unfiltered strip along the top and left edges in Chrome.) Without the lens it is simply blurred.
    // Chrome's backdrop blur only works up to roughly a quarter of the element's shorter side; a bigger radius makes it
    // weaker, not stronger. So the radius follows the size of the glass: as strong as it can be, never past that limit.
    const shortSide = size.w > 0 && size.h > 0 ? Math.min(size.w, size.h) : 80;
    const frost = Math.max(8, Math.min(44, Math.round(shortSide / 4)));
    const backdrop = lens
        ? `url(#${id}) blur(${frost}px) saturate(${saturation}) brightness(1.05)`
        : `blur(${frost}px) saturate(${saturation}) brightness(1.05)`;

    return (
        <div
            ref={ref}
            className={`lg ${className}`}
            data-lens={lens ? 'true' : 'false'}
            style={{
                ...style,
                '--lg-fast': `blur(${frost}px) saturate(${saturation}) brightness(1.05)`,
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                borderRadius: radius,
                WebkitBackdropFilter: backdrop,
                backdropFilter: backdrop,
            } as React.CSSProperties}
        >
            {lens && (
                <svg className="lg-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id={id} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                            <feImage href={map.url} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lens" />
                            <feDisplacementMap in="SourceGraphic" in2="lens" scale={map.scale * 1} xChannelSelector="R" yChannelSelector="G" result="dred" />
                            <feColorMatrix in="dred" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
                            <feDisplacementMap in="SourceGraphic" in2="lens" scale={map.scale * 1.1} xChannelSelector="R" yChannelSelector="G" result="dgreen" />
                            <feColorMatrix in="dgreen" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
                            <feDisplacementMap in="SourceGraphic" in2="lens" scale={map.scale * 1.22} xChannelSelector="R" yChannelSelector="G" result="dblue" />
                            <feColorMatrix in="dblue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
                            <feBlend in="red" in2="green" mode="screen" result="rg" />
                            <feBlend in="rg" in2="blue" mode="screen" />
                        </filter>
                    </defs>
                </svg>
            )}
            <span className="lg-glow" aria-hidden="true" />
            <span className="lg-rim" aria-hidden="true" />
            <div className="lg-content">{children}</div>
        </div>
    );
}
