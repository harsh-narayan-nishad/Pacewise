import { getBitmap } from './imageops';
import { newId } from './pages';
import type { DrawOverlay, ImageOverlay, ImageSource, Overlay, ShapeKind, ShapeOverlay, TextFont, TextOverlay } from './types';

/*
 * Pictures and text placed on a page. They are drawn with one function (`drawOverlays`) everywhere: in the book,
 * in the editor, in thumbnails and in the downloaded PDF, so what you see is what you get.
 */

const FONTS: Record<TextFont, string> = {
    sans: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", "Nirmala UI", sans-serif`,
    serif: `Georgia, "Times New Roman", "Noto Serif", "Noto Serif Devanagari", "Nirmala UI", serif`,
    mono: `ui-monospace, "SF Mono", Menlo, Consolas, "Noto Sans Mono", monospace`,
};
export const FONT_LABELS: Record<TextFont, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono' };

const LINE = 1.28; // line height, in font sizes
const PAD = 0.28; // padding around the text, in font sizes

export const fontString = (o: TextOverlay, px: number) => `${o.italic ? 'italic ' : ''}${o.bold ? '700' : '400'} ${px}px ${FONTS[o.font]}`;

/* ------------------------- creating overlays ------------------------- */

/** `pageAspect` is page width / page height, so a picture keeps its own shape on any page. */
export function newImageOverlay(src: ImageSource, pageAspect: number, index = 0): ImageOverlay {
    const w = Math.min(0.42, 0.42 * (src.width >= src.height ? 1 : 0.8));
    const h = (w * (src.height / src.width)) * pageAspect;
    const k = Math.min(1, 0.7 / Math.max(h, 0.0001)); // keep it inside the page
    const w2 = w * k;
    const h2 = h * k;
    const off = (index % 6) * 0.03;
    return {
        id: newId(),
        type: 'image',
        src,
        x: Math.min(0.9 - w2, Math.max(0.02, (1 - w2) / 2 + off)),
        y: Math.min(0.9 - h2, Math.max(0.02, (1 - h2) / 2 + off)),
        w: w2,
        h: h2,
        rotation: 0,
        opacity: 1,
    };
}

export function newTextOverlay(text = 'Text', index = 0): TextOverlay {
    const off = (index % 6) * 0.03;
    return {
        id: newId(),
        type: 'text',
        text,
        x: 0.2 + off,
        y: 0.35 + off,
        w: 0.6,
        rotation: 0,
        size: 0.035,
        color: '#111111',
        bold: false,
        italic: false,
        align: 'left',
        font: 'sans',
        background: null,
    };
}

export function newShapeOverlay(kind: ShapeKind, pageAspect: number, index = 0): ShapeOverlay {
    const line = kind === 'line' || kind === 'arrow';
    const w = line ? 0.4 : 0.28;
    const h = line ? 0.03 : w * pageAspect; // square on the page
    const off = (index % 6) * 0.03;
    return {
        id: newId(),
        type: 'shape',
        kind,
        x: 0.5 - w / 2 + off,
        y: 0.5 - h / 2 + off,
        w,
        h,
        rotation: 0,
        fill: line ? null : '#6f8f6b',
        stroke: line ? '#222222' : null,
        strokeWidth: line ? 0.006 : 0.004,
        radius: 0,
        opacity: 1,
    };
}

export function newBackgroundOverlay(color: string): ShapeOverlay {
    return { id: newId(), type: 'shape', kind: 'rect', x: 0, y: 0, w: 1, h: 1, rotation: 0, fill: color, stroke: null, strokeWidth: 0, radius: 0, opacity: 1, locked: true, isBackground: true };
}

export function newDrawOverlay(points: [number, number][], color: string, width: number, opacity: number): DrawOverlay | null {
    if (points.length < 2) return null;
    const pad = width / 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of points) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
    }
    // the pen width is a fraction of the page width, so the padding on y is scaled by the caller through `width`
    const w = Math.max(0.004, x1 - x0);
    const h = Math.max(0.004, y1 - y0);
    return {
        id: newId(),
        type: 'draw',
        x: x0 - pad,
        y: y0 - pad,
        w: w + pad * 2,
        h: h + pad * 2,
        rotation: 0,
        points: points.map(([x, y]) => [(x - x0 + pad) / (w + pad * 2), (y - y0 + pad) / (h + pad * 2)] as [number, number]),
        color,
        width,
        opacity,
    };
}

/* ------------------------- laying text out ------------------------- */

let measureCtx: CanvasRenderingContext2D | null = null;
const ctx2d = () => (measureCtx ??= document.createElement('canvas').getContext('2d')!);

/** Letters a reader sees as one, so a long Hindi word is never cut in the middle of a letter. */
function graphemes(s: string): string[] {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
    return Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment) : Array.from(s);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const out: string[] = [];
    const width = (s: string) => ctx.measureText(s).width;
    for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
        if (para === '') {
            out.push('');
            continue;
        }
        let line = '';
        for (const word of para.split(' ')) {
            const test = line ? `${line} ${word}` : word;
            if (width(test) <= maxWidth || !line && width(word) <= maxWidth) {
                line = test;
                continue;
            }
            if (line) out.push(line);
            if (width(word) <= maxWidth) {
                line = word;
            } else {
                // a word wider than the box: break it between letters
                let chunk = '';
                for (const g of graphemes(word)) {
                    if (chunk && width(chunk + g) > maxWidth) {
                        out.push(chunk);
                        chunk = g;
                    } else chunk += g;
                }
                line = chunk;
            }
        }
        out.push(line);
    }
    return out;
}

export interface TextLayout {
    lines: string[];
    fontPx: number;
    lineHeight: number;
    pad: number;
    /** size of the whole box in px */
    width: number;
    height: number;
}

/** Lines, font size and box height of a text overlay on a page of W x H pixels. */
export function layoutText(ctx: CanvasRenderingContext2D, o: TextOverlay, W: number, H: number): TextLayout {
    const fontPx = Math.max(4, o.size * H);
    ctx.font = fontString(o, fontPx);
    const width = o.w * W;
    const pad = fontPx * PAD;
    const lines = wrap(ctx, o.text, Math.max(fontPx, width - pad * 2));
    const lineHeight = fontPx * LINE;
    return { lines, fontPx, lineHeight, pad, width, height: Math.max(lineHeight, lines.length * lineHeight) + pad * 2 };
}

/** Size in px of an overlay's box on a page of W x H pixels (text height depends on its content). */
export function overlayBox(o: Overlay, W: number, H: number): { width: number; height: number } {
    if (o.type !== 'text') return { width: o.w * W, height: o.h * H };
    const l = layoutText(ctx2d(), o, W, H);
    return { width: l.width, height: l.height };
}

/* ------------------------- drawing ------------------------- */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function shapePath(ctx: CanvasRenderingContext2D, kind: ShapeKind, w: number, h: number, radius: number) {
    const hw = w / 2;
    const hh = h / 2;
    const poly = (n: number, rot: number, inner = 1) => {
        ctx.beginPath();
        const pts = n * (inner === 1 ? 1 : 2);
        for (let i = 0; i < pts; i++) {
            const r = inner !== 1 && i % 2 === 1 ? inner : 1;
            const a = rot + (i * 2 * Math.PI) / pts;
            const px = Math.cos(a) * hw * r;
            const py = Math.sin(a) * hh * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    };
    switch (kind) {
        case 'ellipse':
            ctx.beginPath();
            ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
            break;
        case 'triangle':
            ctx.beginPath();
            ctx.moveTo(0, -hh);
            ctx.lineTo(hw, hh);
            ctx.lineTo(-hw, hh);
            ctx.closePath();
            break;
        case 'diamond':
            poly(4, -Math.PI / 2);
            break;
        case 'pentagon':
            poly(5, -Math.PI / 2);
            break;
        case 'hexagon':
            poly(6, 0);
            break;
        case 'star':
            poly(5, -Math.PI / 2, 0.45);
            break;
        case 'heart':
            ctx.beginPath();
            ctx.moveTo(0, hh);
            ctx.bezierCurveTo(-hw * 1.25, hh * 0.1, -hw * 0.75, -hh, 0, -hh * 0.35);
            ctx.bezierCurveTo(hw * 0.75, -hh, hw * 1.25, hh * 0.1, 0, hh);
            ctx.closePath();
            break;
        case 'line':
            ctx.beginPath();
            ctx.moveTo(-hw, 0);
            ctx.lineTo(hw, 0);
            break;
        case 'arrow':
            ctx.beginPath();
            ctx.moveTo(-hw, 0);
            ctx.lineTo(hw, 0);
            break;
        default:
            roundRect(ctx, -hw, -hh, w, h, Math.min(w, h) * radius);
    }
}

/** Draws overlays onto a canvas that stands for the page, bottom to top. */
export async function drawOverlays(ctx: CanvasRenderingContext2D, W: number, H: number, overlays: Overlay[], skipId?: string | null) {
    for (const o of overlays) {
        if (o.id === skipId) continue;
        ctx.save();
        const shadow = () => {
            if (!o.shadow) return;
            ctx.shadowColor = 'rgba(0,0,0,0.38)';
            ctx.shadowBlur = Math.max(4, W * 0.012);
            ctx.shadowOffsetY = Math.max(2, W * 0.005);
        };
        const noShadow = () => {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        };
        if (o.type === 'image') {
            const bitmap = await getBitmap(o.src);
            const bw = o.w * W;
            const bh = o.h * H;
            ctx.translate(o.x * W + bw / 2, o.y * H + bh / 2);
            ctx.rotate((o.rotation * Math.PI) / 180);
            ctx.globalAlpha = o.opacity;
            const r = Math.min(bw, bh) * (o.radius ?? 0);
            if (o.shadow) {
                shadow();
                ctx.fillStyle = '#000';
                roundRect(ctx, -bw / 2, -bh / 2, bw, bh, r);
                ctx.fill();
                noShadow();
            }
            ctx.save();
            if (r > 0) {
                roundRect(ctx, -bw / 2, -bh / 2, bw, bh, r);
                ctx.clip();
            }
            const f: string[] = [];
            if (o.brightness !== undefined && o.brightness !== 100) f.push(`brightness(${o.brightness}%)`);
            if (o.contrast !== undefined && o.contrast !== 100) f.push(`contrast(${o.contrast}%)`);
            if (o.saturate !== undefined && o.saturate !== 100) f.push(`saturate(${o.saturate}%)`);
            if (o.grayscale) f.push(`grayscale(${o.grayscale}%)`);
            if (o.sepia) f.push(`sepia(${o.sepia}%)`);
            if (o.blur) f.push(`blur(${(o.blur / 100) * W * 0.03}px)`);
            if (f.length) ctx.filter = f.join(' ');
            ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
            ctx.drawImage(bitmap, -bw / 2, -bh / 2, bw, bh);
            ctx.restore();
            if (o.borderColor && o.borderWidth) {
                ctx.strokeStyle = o.borderColor;
                ctx.lineWidth = o.borderWidth * W;
                roundRect(ctx, -bw / 2, -bh / 2, bw, bh, r);
                ctx.stroke();
            }
        } else if (o.type === 'shape') {
            const bw = o.w * W;
            const bh = o.h * H;
            ctx.translate(o.x * W + bw / 2, o.y * H + bh / 2);
            ctx.rotate((o.rotation * Math.PI) / 180);
            ctx.globalAlpha = o.opacity;
            shadow();
            shapePath(ctx, o.kind, bw, bh, o.radius);
            if (o.fill && o.kind !== 'line' && o.kind !== 'arrow') {
                ctx.fillStyle = o.fill;
                ctx.fill();
            }
            const lw = Math.max(0, o.strokeWidth * W);
            if (o.stroke && lw > 0) {
                ctx.strokeStyle = o.stroke;
                ctx.lineWidth = lw;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            if (o.kind === 'arrow') {
                // Excalidraw's arrowhead: two open strokes at about 25° to the shaft, sized to the arrow and the line
                const w0 = lw || 2;
                const head = Math.min(bw * 0.35, Math.max(w0 * 7, 18));
                const a = (25 * Math.PI) / 180;
                ctx.strokeStyle = o.stroke ?? '#222';
                ctx.lineWidth = w0;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(bw / 2 - head * Math.cos(a), -head * Math.sin(a));
                ctx.lineTo(bw / 2, 0);
                ctx.lineTo(bw / 2 - head * Math.cos(a), head * Math.sin(a));
                ctx.stroke();
            }
        } else if (o.type === 'draw') {
            const bw = o.w * W;
            const bh = o.h * H;
            ctx.translate(o.x * W + bw / 2, o.y * H + bh / 2);
            ctx.rotate((o.rotation * Math.PI) / 180);
            ctx.globalAlpha = o.opacity;
            shadow();
            ctx.strokeStyle = o.color;
            ctx.lineWidth = Math.max(1, o.width * W);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            o.points.forEach(([px, py], i) => {
                const x = -bw / 2 + px * bw;
                const y = -bh / 2 + py * bh;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            if (o.points.length === 1) ctx.lineTo(-bw / 2 + o.points[0][0] * bw + 0.01, -bh / 2 + o.points[0][1] * bh);
            ctx.stroke();
        } else {
            const L = layoutText(ctx, o, W, H);
            ctx.translate(o.x * W + L.width / 2, o.y * H + L.height / 2);
            ctx.rotate((o.rotation * Math.PI) / 180);
            ctx.globalAlpha = o.opacity ?? 1;
            shadow();
            if (o.background) {
                ctx.fillStyle = o.background;
                roundRect(ctx, -L.width / 2, -L.height / 2, L.width, L.height, L.fontPx * 0.25);
                ctx.fill();
            }
            ctx.fillStyle = o.color;
            ctx.textBaseline = 'middle';
            ctx.textAlign = o.align;
            const tx = o.align === 'left' ? -L.width / 2 + L.pad : o.align === 'right' ? L.width / 2 - L.pad : 0;
            L.lines.forEach((line, i) => {
                const ly = -L.height / 2 + L.pad + L.lineHeight * (i + 0.5);
                ctx.fillText(line, tx, ly);
                if (o.underline && line) {
                    const lw = ctx.measureText(line).width;
                    const x0 = o.align === 'left' ? tx : o.align === 'right' ? tx - lw : tx - lw / 2;
                    ctx.fillRect(x0, ly + L.fontPx * 0.46, lw, Math.max(1, L.fontPx * 0.06));
                }
            });
        }
        ctx.restore();
    }
}
