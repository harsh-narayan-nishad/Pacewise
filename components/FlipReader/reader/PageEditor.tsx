'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AlignCenter,
    AlignHorizontalJustifyCenter,
    AlignHorizontalJustifyEnd,
    AlignHorizontalJustifyStart,
    AlignLeft,
    AlignRight,
    AlignVerticalJustifyCenter,
    AlignVerticalJustifyEnd,
    AlignVerticalJustifyStart,
    Bold,
    BringToFront,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Copy,
    FlipHorizontal2,
    FlipVertical2,
    Image as ImageIcon,
    Italic,
    Layers,
    Lock,
    MousePointer2,
    Palette,
    Pencil,
    Redo2,
    RotateCcw,
    RotateCw,
    SendToBack,
    Shapes,
    Smile,
    Trash2,
    Type as TypeIcon,
    Underline,
    Undo2,
    Unlock,
    Upload,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';

import LiquidGlass from '@/components/FlipReader/ui/LiquidGlass';
import { fileToImageSource, getBitmap, renderEdit, toBlob } from '@/lib/flipreader/imageops';
import { openPdfSource } from '@/lib/flipreader/loaders';
import { FONT_LABELS, fontString, newBackgroundOverlay, newDrawOverlay, newImageOverlay, newShapeOverlay, newTextOverlay, overlayBox } from '@/lib/flipreader/overlays';
import { newId } from '@/lib/flipreader/pages';
import type { ImageSource, Overlay, PageItem, ShapeKind, TextFont, TextOverlay } from '@/lib/flipreader/types';
import { OverlayLayer } from './OverlayLayer';

type Handle = 'nw' | 'ne' | 'se' | 'sw' | 'w' | 'e' | 'n' | 's' | 'rot';

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const BASE_SIDE = 1600; // resolution of the page shown in the editor

function Slider({ label, value, min, max, step = 1, suffix = '', onStart, onChange, onEnd }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onStart: () => void; onChange: (v: number) => void; onEnd: () => void }) {
    return (
        <label className="rd-slider">
            <span>{label}</span>
            <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onPointerDown={onStart} onKeyDown={onStart} onPointerUp={onEnd} onKeyUp={onEnd} onBlur={onEnd} onChange={(e) => onChange(Number(e.target.value))} />
            <output>
                {value}
                {suffix}
            </output>
        </label>
    );
}

interface Drag {
    mode: 'move' | Handle;
    id: string;
    sx: number;
    sy: number;
    o0: Overlay;
    /** centre of the box in client pixels */
    cx: number;
    cy: number;
    /** distance from the centre / angle at the start */
    d0: number;
    a0: number;
}


/* ---------- the library on the right ---------- */

type Tab = 'uploads' | 'photos' | 'elements' | 'text' | 'background';
type Tool = 'select' | 'pen';

type Lib =
    | { id: string; kind: 'image'; src: ImageSource; url: string }
    | { id: string; kind: 'text'; name: string; text: string; code: boolean }
    | { id: string; kind: 'file'; name: string; label: string };

/* ---------- reading any kind of file ---------- */

const isSvg = (f: File) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);
const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const keepsAlpha = (f: File) => isSvg(f) || /^image\/(png|gif|webp|avif)$/.test(f.type) || /\.(png|gif|webp|avif)$/i.test(f.name);
const isPictureFile = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif|svg|ico|tiff?)$/i.test(f.name);
const TEXT_EXT = /\.(txt|md|markdown|log|rtf|csv|tsv|json|jsonc|xml|ya?ml|toml|ini|env|cfg|conf|js|jsx|mjs|cjs|ts|tsx|py|java|kt|kts|c|h|cc|cpp|hpp|cs|go|rs|rb|php|swift|sql|sh|bash|zsh|ps1|bat|html?|css|scss|sass|less|vue|svelte|dart|lua|r|m|scala|pl|gradle|tex|graphql|proto|dockerfile|makefile)$/i;
const isTextual = (f: File) => f.type.startsWith('text/') || /(json|xml|javascript|typescript|x-sh|yaml)/.test(f.type) || TEXT_EXT.test(f.name);
const TEXT_LIMIT = 4000;

const newSource = (name: string, blob: Blob, width: number, height: number): ImageSource => ({ id: newId(), kind: 'image', name, blob, width, height });

/** A picture that keeps its see-through parts (PNG, GIF, WebP, SVG ...). */
async function pictureSource(file: File): Promise<ImageSource> {
    const canvas = document.createElement('canvas');
    let w: number;
    let h: number;
    if (isSvg(file)) {
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error(`"${file.name}" could not be read as an image.`));
                img.src = url;
            });
            const nw = img.naturalWidth || 800;
            const nh = img.naturalHeight || 600;
            const k = 1600 / Math.max(nw, nh); // vectors are drawn big, so they stay sharp
            w = Math.max(1, Math.round(nw * k));
            h = Math.max(1, Math.round(nh * k));
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        } finally {
            URL.revokeObjectURL(url);
        }
    } else {
        const bitmap = await createImageBitmap(file);
        const k = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
        w = Math.max(1, Math.round(bitmap.width * k));
        h = Math.max(1, Math.round(bitmap.height * k));
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
    }
    return newSource(file.name, await toBlob(canvas, 'image/png', 1), w, h);
}

type Payload = { k: 'shape'; kind: ShapeKind } | { k: 'emoji'; ch: string } | { k: 'text'; i: number } | { k: 'lib'; id: string } | { k: 'photo'; id: number };

/** A text item for an uploaded code / text file or a file label. */
function textFromLib(l: Lib): Overlay | null {
    if (l.kind === 'image') return null;
    const o = newTextOverlay(l.kind === 'text' ? l.text : l.label, 0);
    if (l.kind === 'text') return { ...o, ...(l.code ? { font: 'mono' as const, size: 0.02, w: 0.8, x: 0.1, y: 0.1, background: '#f4f6f8', color: '#1f2328' } : { size: 0.028, w: 0.8, x: 0.1, y: 0.1 }) };
    return { ...o, size: 0.03, w: 0.7, background: '#eef1f4', color: '#1f2328' };
}

const PW_MIME = 'application/x-pacewise-item';

const SHAPES: { kind: ShapeKind; label: string; d: string; line?: boolean }[] = [
    { kind: 'rect', label: 'Square', d: 'M5 5h22v22H5z' },
    { kind: 'ellipse', label: 'Circle', d: 'M16 4a12 12 0 1 0 0.01 0z' },
    { kind: 'triangle', label: 'Triangle', d: 'M16 4l13 24H3z' },
    { kind: 'diamond', label: 'Diamond', d: 'M16 3l13 13-13 13L3 16z' },
    { kind: 'pentagon', label: 'Pentagon', d: 'M16 3l13 9.5-5 15.5H8L3 12.5z' },
    { kind: 'hexagon', label: 'Hexagon', d: 'M9 4h14l7 12-7 12H9L2 16z' },
    { kind: 'star', label: 'Star', d: 'M16 3l3.8 8.3 9 1-6.7 6.1 1.9 8.9L16 22.7 8 27.3l1.9-8.9L3.2 12.3l9-1z' },
    { kind: 'heart', label: 'Heart', d: 'M16 28C4 19 3 10.5 8.5 7c3.2-2 6.4-.7 7.5 2 1.1-2.7 4.3-4 7.5-2C29 10.5 28 19 16 28z' },
    { kind: 'line', label: 'Line', d: 'M3 16h26', line: true },
    { kind: 'arrow', label: 'Arrow', d: 'M3 16h25M21 9l7 7-7 7', line: true },
];

const EMOJI = '😀 😍 😎 🤔 😂 🥳 😴 🤯 👍 👏 🙏 💪 ✅ ❌ ⭐ 🌟 ❤️ 💡 🔥 ✨ 🎯 📌 📎 📝 📚 🎓 🧠 ⏰ 📅 💬 ❓ ❗ ⚠️ 🚀 🏆 🎉 🌈 ☀️ 🌙 🌱 🍀 🎨 ✏️ 🔍 🔔 💯 ➡️ ⬅️ ⬆️ ⬇️ ✔️ ➕ ➖ 🟢 🟡 🔴 🔵'.split(' ');

const TEXT_STYLES: { label: string; sample: string; text: string; patch: Partial<TextOverlay> }[] = [
    { label: 'Heading', sample: 'Add a heading', text: 'Heading', patch: { size: 0.07, bold: true, w: 0.8, x: 0.1 } },
    { label: 'Subheading', sample: 'Add a subheading', text: 'Subheading', patch: { size: 0.045, bold: true, w: 0.7, x: 0.15 } },
    { label: 'Body', sample: 'Add a little body text', text: 'Body text', patch: { size: 0.03 } },
    { label: 'Quote', sample: '“A serif quote”', text: '“Quote”', patch: { size: 0.045, italic: true, font: 'serif', align: 'center' } },
    { label: 'Highlight', sample: 'Highlighted note', text: 'Note', patch: { size: 0.035, background: '#fff59d' } },
    { label: 'Label', sample: 'DARK LABEL', text: 'LABEL', patch: { size: 0.035, bold: true, color: '#ffffff', background: '#222222', align: 'center', w: 0.4 } },
    { label: 'Code', sample: 'mono.code()', text: 'code()', patch: { size: 0.03, font: 'mono', background: '#eceff1' } },
];

const BACKGROUNDS = ['#ffffff', '#fbf7ef', '#f5f0e6', '#f2f2f2', '#d9d9d9', '#1a1b1e', '#0b0c0e', '#fde2e4', '#fad2e1', '#e2ece9', '#bee1e6', '#dfe7fd', '#cddafd', '#f0efeb', '#fff1c1', '#ffd6a5', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#5f7a5c', '#8da586', '#b88a2e'];

const PHOTOS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37];

const GUIDE_SNAP = 0.012;

function ShapeIcon({ d, line }: { d: string; line?: boolean }) {
    return (
        <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
            <path d={d} fill={line ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={line ? 2.5 : 1} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <label className="rd-field rd-color">
            <span className="rd-label">{label}</span>
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}

const labelOf = (o: Overlay) => (o.type === 'text' ? o.text.replace(/\s+/g, ' ').slice(0, 22) || 'Text' : o.type === 'image' ? 'Picture' : o.type === 'shape' ? (o.isBackground ? 'Background' : SHAPES.find((s) => s.kind === o.kind)?.label ?? 'Shape') : 'Drawing');

/**
 * Put pictures, text, shapes and drawings on top of a page (a PDF page or a picture page). Tools on the left, the page
 * in the middle, a library of pictures, elements, text styles and backgrounds on the right. Drag from the library onto
 * the page, or tap an item to add it; drag to move, corner handles to resize, the round handle to turn.
 */
export function PageEditor({ item, onApply, onCancel, pageNo, pageCount, onGo, onDeletePage }: { item: PageItem; onApply: (overlays: Overlay[]) => void; onCancel: () => void; pageNo?: number; pageCount?: number; onGo?: (overlays: Overlay[], delta: number) => void; onDeletePage?: () => void }) {
    const [overlays, setOverlays] = useState<Overlay[]>(item.overlays);
    const ref = useRef<Overlay[]>(item.overlays);
    const past = useRef<Overlay[][]>([]);
    const future = useRef<Overlay[][]>([]);
    const gesture = useRef(false);
    const [selId, setSelId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [tool, setTool] = useState<Tool>('select');
    const [tab, setTab] = useState<Tab>('uploads');
    const [zoom, setZoomState] = useState(1);
    const zoomRef = useRef(1);
    const [confirmDel, setConfirmDel] = useState(false);
    /** the text item being typed into straight on the page */
    const [editingId, setEditingId] = useState<string | null>(null);
    useEffect(() => {
        if (!confirmDel) return undefined;
        const t = setTimeout(() => setConfirmDel(false), 3500);
        return () => clearTimeout(t);
    }, [confirmDel]);
    const [guides, setGuides] = useState<{ axis: 'v' | 'h'; pos: number }[]>([]);
    const [lib, setLib] = useState<Lib[]>([]);
    const libRef = useRef<Lib[]>([]);
    const [pen, setPen] = useState({ color: '#222222', width: 0.006, opacity: 1 });
    const [stroke, setStroke] = useState<[number, number][] | null>(null);

    const baseRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const [base, setBase] = useState({ w: 1, h: 1 });
    const [stage, setStage] = useState({ w: 0, h: 0 });
    const [failed, setFailed] = useState(false);

    useEffect(
        () => () => {
            libRef.current.forEach((l) => l.kind === 'image' && URL.revokeObjectURL(l.url));
        },
        []
    );

    /* ---- the page underneath ---- */
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                let out: HTMLCanvasElement;
                if (item.type === 'image') {
                    out = renderEdit(await getBitmap(item.src), item.edit, BASE_SIDE);
                } else {
                    const page = await item.src.pdf.getPage(item.index + 1);
                    const b = page.getViewport({ scale: 1 });
                    const vp = page.getViewport({ scale: BASE_SIDE / Math.max(b.width, b.height) });
                    out = document.createElement('canvas');
                    out.width = Math.max(1, Math.floor(vp.width));
                    out.height = Math.max(1, Math.floor(vp.height));
                    const ctx = out.getContext('2d')!;
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, out.width, out.height);
                    await page.render({ canvasContext: ctx, canvas: out, viewport: vp } as any).promise;
                    page.cleanup();
                }
                if (!alive || !baseRef.current) return;
                baseRef.current.width = out.width;
                baseRef.current.height = out.height;
                baseRef.current.getContext('2d')?.drawImage(out, 0, 0);
                setBase({ w: out.width, h: out.height });
            } catch {
                if (alive) setFailed(true);
            }
        })();
        return () => {
            alive = false;
        };
    }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const el = stageRef.current;
        if (!el) return undefined;
        const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    /** Zoom the page (25% to 400%) and keep the middle of what you are looking at where it is. */
    const setZoom = useCallback((z: number | ((v: number) => number)) => {
        const el = stageRef.current;
        const next = clamp(Math.round((typeof z === 'function' ? z(zoomRef.current) : z) * 1000) / 1000, 0.25, 4);
        if (next === zoomRef.current) return;
        const cx = el && el.scrollWidth ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 0.5;
        const cy = el && el.scrollHeight ? (el.scrollTop + el.clientHeight / 2) / el.scrollHeight : 0.5;
        zoomRef.current = next;
        setZoomState(next);
        requestAnimationFrame(() => {
            if (!el) return;
            el.scrollLeft = cx * el.scrollWidth - el.clientWidth / 2;
            el.scrollTop = cy * el.scrollHeight - el.clientHeight / 2;
        });
    }, []);

    /* pinch with two fingers, or Ctrl / Cmd + scroll wheel (a trackpad pinch counts as that), to zoom */
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return undefined;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            e.stopPropagation();
            setZoom((z) => z * Math.exp(-e.deltaY * 0.01));
        };
        let start = 0;
        let z0 = 1;
        const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                start = dist(e.touches);
                z0 = zoomRef.current;
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && start > 0) {
                e.preventDefault();
                setZoom(z0 * (dist(e.touches) / start));
            }
        };
        const onTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) start = 0;
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [setZoom]);

    const fit = Math.min((stage.w - 40) / base.w, (stage.h - 40) / base.h) || 1;
    const dispW = Math.max(1, base.w * fit * zoom);
    const dispH = Math.max(1, base.h * fit * zoom);
    const pageAspect = base.w / base.h;

    /* ---- changing overlays, with undo / redo ---- */
    const set = useCallback((next: Overlay[], record = true) => {
        if (record) {
            past.current.push(ref.current);
            if (past.current.length > 80) past.current.shift();
            future.current = [];
        }
        ref.current = next;
        setOverlays(next);
    }, []);
    const startGesture = useCallback(() => {
        if (gesture.current) return;
        gesture.current = true;
        past.current.push(ref.current);
        future.current = [];
    }, []);
    const endGesture = useCallback(() => {
        gesture.current = false;
    }, []);
    const undo = useCallback(() => {
        const prev = past.current.pop();
        if (!prev) return;
        future.current.push(ref.current);
        ref.current = prev;
        setOverlays(prev);
    }, []);
    const redo = useCallback(() => {
        const next = future.current.pop();
        if (!next) return;
        past.current.push(ref.current);
        ref.current = next;
        setOverlays(next);
    }, []);

    useEffect(() => {
        if (editingId && selId !== editingId) {
            setEditingId(null);
            gesture.current = false;
        }
    }, [selId, editingId]);

    const patch = (id: string, change: Partial<Overlay>, record = false) =>
        set(ref.current.map((o) => (o.id === id ? ({ ...o, ...change } as Overlay) : o)), record);

    const sel = overlays.find((o) => o.id === selId) ?? null;

    /* ---- adding ---- */
    /** Puts new items on the page; with `at` (0 to 1 on the page) their centre goes there, like a drop. */
    const addOverlays = useCallback(
        (list: Overlay[], at?: { x: number; y: number }) => {
            const placed = at
                ? list.map((o, i) => {
                      const b = overlayBox(o, dispW, dispH);
                      return { ...o, x: at.x - b.width / dispW / 2 + i * 0.03, y: at.y - b.height / dispH / 2 + i * 0.03 } as Overlay;
                  })
                : list;
            set([...ref.current, ...placed]);
            setSelId(placed[placed.length - 1].id);
            setTool('select');
        },
        [dispW, dispH, set]
    );

    /**
     * Take in any files: pictures (also see-through PNG, GIF, WebP, SVG), PDFs (every page becomes a picture),
     * code and text files, and anything else (placed as a small file label). They all land in the Uploads tab.
     */
    const addFiles = useCallback(
        async (files: File[], at?: { x: number; y: number }, putOnPage = true) => {
            if (files.length === 0) return;
            setBusy(true);
            setMessage(null);
            const entries: Lib[] = [];
            const added: Overlay[] = [];
            const problems: string[] = [];
            const pictureEntry = (src: ImageSource, onPage: boolean) => {
                entries.push({ id: src.id, kind: 'image', src, url: URL.createObjectURL(src.blob) });
                if (onPage) added.push(newImageOverlay(src, pageAspect, ref.current.length + added.length));
            };
            for (const file of files) {
                try {
                    if (isPdfFile(file)) {
                        setMessage(`Reading ${file.name}…`);
                        const pdfSrc = await openPdfSource(file);
                        const n = Math.min(pdfSrc.pageCount, 40);
                        for (let i = 1; i <= n; i++) {
                            const page = await pdfSrc.pdf.getPage(i);
                            const b0 = page.getViewport({ scale: 1 });
                            const vp = page.getViewport({ scale: 1100 / Math.max(b0.width, 1) });
                            const c = document.createElement('canvas');
                            c.width = Math.max(1, Math.floor(vp.width));
                            c.height = Math.max(1, Math.floor(vp.height));
                            const cx = c.getContext('2d')!;
                            cx.fillStyle = '#fff';
                            cx.fillRect(0, 0, c.width, c.height);
                            await page.render({ canvasContext: cx, canvas: c, viewport: vp } as any).promise;
                            page.cleanup();
                            pictureEntry(newSource(`${file.name} · page ${i}`, await toBlob(c, 'image/jpeg', 0.9), c.width, c.height), i === 1);
                        }
                        if (pdfSrc.pageCount > n) problems.push(`"${file.name}" has ${pdfSrc.pageCount} pages; the first ${n} were added.`);
                        void pdfSrc.pdf.destroy();
                    } else if (isPictureFile(file)) {
                        let src: ImageSource;
                        if (keepsAlpha(file)) {
                            try {
                                src = await pictureSource(file);
                            } catch (e) {
                                if (isSvg(file)) throw e;
                                src = await fileToImageSource(file);
                            }
                        } else src = await fileToImageSource(file);
                        pictureEntry(src, true);
                    } else if (isTextual(file) && file.size <= 5_000_000) {
                        const raw = await file.text();
                        if (raw.includes('\u0000')) throw new Error('binary');
                        const code = !/\.(txt|md|markdown|log|rtf)$/i.test(file.name);
                        const textBody = raw.replace(/\t/g, '    ');
                        if (textBody.length > TEXT_LIMIT) problems.push(`"${file.name}" is long; the first ${TEXT_LIMIT} characters were added.`);
                        const e: Lib = { id: newId(), kind: 'text', name: file.name, text: textBody.slice(0, TEXT_LIMIT), code };
                        entries.push(e);
                        const o = textFromLib(e);
                        if (o) added.push(o);
                    } else {
                        const kb = file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`;
                        const e: Lib = { id: newId(), kind: 'file', name: file.name, label: `📎 ${file.name} · ${kb}` };
                        entries.push(e);
                        const o = textFromLib(e);
                        if (o) added.push(o);
                    }
                } catch (err) {
                    problems.push(err instanceof Error && err.message && err.message !== 'binary' ? err.message : `"${file.name}" could not be added.`);
                }
            }
            libRef.current = [...entries.reverse(), ...libRef.current];
            setLib(libRef.current);
            setTab('uploads');
            setBusy(false);
            setMessage(problems.length ? problems.join(' ') : null);
            if (putOnPage && added.length) addOverlays(added, at);
        },
        [pageAspect, addOverlays]
    );

    const addText = useCallback(
        (text = 'Text', patchText: Partial<TextOverlay> = {}, at?: { x: number; y: number }, edit = false) => {
            const o = { ...newTextOverlay(text.slice(0, 4000), ref.current.length), ...patchText } as TextOverlay;
            addOverlays([o], at);
            if (edit) setEditingId(o.id);
        },
        [addOverlays]
    );

    const addPhoto = useCallback(
        async (id: number, at?: { x: number; y: number }) => {
            setBusy(true);
            setMessage(null);
            try {
                const res = await fetch(`https://picsum.photos/id/${id}/1400/1000`);
                if (!res.ok) throw new Error('bad status');
                const blob = await res.blob();
                setBusy(false);
                await addFiles([new File([blob], `photo-${id}.jpg`, { type: blob.type || 'image/jpeg' })], at);
            } catch {
                setBusy(false);
                setMessage('Could not load this photo. Photos need an internet connection.');
            }
        },
        [addFiles]
    );

    const addFromPayload = (p: Payload, at?: { x: number; y: number }) => {
        if (p.k === 'shape') addOverlays([newShapeOverlay(p.kind, pageAspect, ref.current.length)], at);
        else if (p.k === 'emoji') addText(p.ch, { size: 0.1, w: 0.2, align: 'center' }, at);
        else if (p.k === 'text') {
            const st = TEXT_STYLES[p.i];
            addText(st.text, st.patch, at, true);
        } else if (p.k === 'lib') {
            const l = libRef.current.find((x) => x.id === p.id);
            if (l?.kind === 'image') addOverlays([newImageOverlay(l.src, pageAspect, ref.current.length)], at);
            else if (l) {
                const o = textFromLib(l);
                if (o) addOverlays([o], at);
            }
        } else void addPhoto(p.id, at);
    };

    const pasteFromButton = async () => {
        setMessage(null);
        try {
            const items = await navigator.clipboard.read();
            for (const it of items) {
                const type = it.types.find((t) => t.startsWith('image/'));
                if (type) {
                    const blob = await it.getType(type);
                    await addFiles([new File([blob], 'pasted.png', { type })]);
                    return;
                }
            }
        } catch {
            /* images may not be readable: try text */
        }
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) addText(text);
            else setMessage('The clipboard is empty.');
        } catch {
            setMessage('Your browser did not allow reading the clipboard. Press Ctrl+V (or Cmd+V) on the page instead.');
        }
    };

    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
            const files = Array.from(e.clipboardData?.files ?? []);
            if (files.length) {
                e.preventDefault();
                void addFiles(files);
                return;
            }
            const text = e.clipboardData?.getData('text/plain');
            if (text && text.trim()) {
                e.preventDefault();
                addText(text);
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [addFiles, addText]);

    const setBackground = (color: string | null) => {
        const rest = ref.current.filter((o) => !(o.type === 'shape' && o.isBackground));
        set(color ? [newBackgroundOverlay(color), ...rest] : rest);
        setSelId(null);
    };

    /* ---- layers, copies, removal ---- */
    const removeId = (id: string) => {
        set(ref.current.filter((o) => o.id !== id));
        if (selId === id) setSelId(null);
    };
    const remove = () => sel && removeId(sel.id);
    const duplicate = () => {
        if (!sel) return;
        const copy = { ...sel, id: newId(), locked: false, x: Math.min(0.9, sel.x + 0.03), y: Math.min(0.9, sel.y + 0.03) } as Overlay;
        set([...ref.current, copy]);
        setSelId(copy.id);
    };
    const reorderId = (id: string, to: 'front' | 'back' | 'up' | 'down') => {
        const o = ref.current.find((x) => x.id === id);
        if (!o) return;
        const list = ref.current.filter((x) => x.id !== id);
        const i = ref.current.findIndex((x) => x.id === id);
        const at = to === 'front' ? list.length : to === 'back' ? 0 : to === 'up' ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
        list.splice(at, 0, o);
        set(list);
    };
    const turn = (deg: number) => sel && patch(sel.id, { rotation: (((sel.rotation + deg) % 360) + 360) % 360 }, true);

    const align = (to: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (!sel) return;
        const b = overlayBox(sel, dispW, dispH);
        const bw = b.width / dispW;
        const bh = b.height / dispH;
        if (to === 'left') patch(sel.id, { x: 0 }, true);
        else if (to === 'center') patch(sel.id, { x: 0.5 - bw / 2 }, true);
        else if (to === 'right') patch(sel.id, { x: 1 - bw }, true);
        else if (to === 'top') patch(sel.id, { y: 0 }, true);
        else if (to === 'middle') patch(sel.id, { y: 0.5 - bh / 2 }, true);
        else patch(sel.id, { y: 1 - bh }, true);
    };

    /* ---- dragging ---- */
    const drag = useRef<Drag | null>(null);

    const centre = (o: Overlay) => {
        const f = frameRef.current!.getBoundingClientRect();
        const b = overlayBox(o, dispW, dispH);
        return { cx: f.left + o.x * dispW + b.width / 2, cy: f.top + o.y * dispH + b.height / 2 };
    };

    const down = (o: Overlay, mode: Drag['mode']) => (e: React.PointerEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setSelId(o.id);
        if (o.locked) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        startGesture();
        const { cx, cy } = centre(o);
        drag.current = {
            mode,
            id: o.id,
            sx: e.clientX,
            sy: e.clientY,
            o0: o,
            cx,
            cy,
            d0: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)),
            a0: Math.atan2(e.clientY - cy, e.clientX - cx),
        };
    };

    const snap = (pos: number, size: number) => {
        const cands: { v: number; g: number }[] = [
            { v: 0, g: 0 },
            { v: 0.5 - size / 2, g: 0.5 },
            { v: 1 - size, g: 1 },
        ];
        for (const c of cands) if (Math.abs(pos - c.v) < GUIDE_SNAP) return { pos: c.v, g: c.g };
        return { pos, g: null as number | null };
    };

    const move = (e: React.PointerEvent<HTMLElement>) => {
        const d = drag.current;
        if (!d) return;
        const o0 = d.o0;
        const b0 = overlayBox(o0, dispW, dispH);
        let next: Overlay = o0;

        if (d.mode === 'move') {
            let x = clamp(o0.x + (e.clientX - d.sx) / dispW, -o0.w * 0.9, 1 - o0.w * 0.1);
            let y = clamp(o0.y + (e.clientY - d.sy) / dispH, -(b0.height / dispH) * 0.9, 1 - (b0.height / dispH) * 0.1);
            if (!e.altKey && o0.rotation % 180 === 0) {
                const sx = snap(x, b0.width / dispW);
                const sy = snap(y, b0.height / dispH);
                x = sx.pos;
                y = sy.pos;
                const g: { axis: 'v' | 'h'; pos: number }[] = [];
                if (sx.g !== null) g.push({ axis: 'v', pos: sx.g });
                if (sy.g !== null) g.push({ axis: 'h', pos: sy.g });
                setGuides(g);
            } else setGuides([]);
            next = { ...o0, x, y };
        } else if (d.mode === 'rot') {
            let deg = o0.rotation + ((Math.atan2(e.clientY - d.cy, e.clientX - d.cx) - d.a0) * 180) / Math.PI;
            deg = ((deg % 360) + 360) % 360;
            const snapDeg = Math.round(deg / 15) * 15;
            if (e.shiftKey || Math.abs(deg - snapDeg) < 3) deg = snapDeg % 360; // click into place at 0, 15, 30 ...
            next = { ...o0, rotation: deg };
        } else if (d.mode === 'w' || d.mode === 'e') {
            // change the width along the item's own direction, keeping the other edge still
            if (o0.type !== 'text' && o0.type !== 'shape') return;
            const th = (o0.rotation * Math.PI) / 180;
            const along = (e.clientX - d.sx) * Math.cos(th) + (e.clientY - d.sy) * Math.sin(th);
            const delta = d.mode === 'e' ? along : -along;
            const w = clamp(o0.w + delta / dispW, 0.02, 2);
            const grown = (w - o0.w) * dispW; // px
            const sign = d.mode === 'e' ? 1 : -1;
            const ccx = d.cx + Math.cos(th) * (grown / 2) * sign; // the centre moves half the growth
            const ccy = d.cy + Math.sin(th) * (grown / 2) * sign;
            const f = frameRef.current!.getBoundingClientRect();
            const trial = { ...o0, w } as Overlay;
            const bh = overlayBox(trial, dispW, dispH).height;
            next = { ...trial, x: (ccx - f.left) / dispW - w / 2, y: (ccy - f.top) / dispH - bh / dispH / 2 } as Overlay;
        } else if (d.mode === 'n' || d.mode === 's') {
            if (o0.type !== 'shape') return;
            const th = (o0.rotation * Math.PI) / 180;
            const along = -(e.clientX - d.sx) * Math.sin(th) + (e.clientY - d.sy) * Math.cos(th);
            const delta = d.mode === 's' ? along : -along;
            const h = clamp(o0.h + delta / dispH, 0.01, 2);
            const grown = (h - o0.h) * dispH;
            const sign = d.mode === 's' ? 1 : -1;
            const ccx = d.cx - Math.sin(th) * (grown / 2) * sign;
            const ccy = d.cy + Math.cos(th) * (grown / 2) * sign;
            const f = frameRef.current!.getBoundingClientRect();
            next = { ...o0, h, x: (ccx - f.left) / dispW - o0.w / 2, y: (ccy - f.top) / dispH - h / 2 };
        } else {
            // a corner: scale around the centre, like pinching
            const s = clamp(Math.hypot(e.clientX - d.cx, e.clientY - d.cy) / d.d0, 0.15, 6);
            const f = frameRef.current!.getBoundingClientRect();
            const w = clamp(o0.w * s, 0.03, 3);
            let trial: Overlay;
            if (o0.type === 'text') trial = { ...o0, w, size: clamp(o0.size * (w / o0.w), 0.008, 0.4) };
            else trial = { ...o0, w, h: o0.h * (w / o0.w) };
            const bh = overlayBox(trial, dispW, dispH).height;
            next = { ...trial, x: (d.cx - f.left) / dispW - w / 2, y: (d.cy - f.top) / dispH - bh / dispH / 2 };
        }
        set(ref.current.map((o) => (o.id === d.id ? next : o)), false);
    };

    const up = () => {
        drag.current = null;
        setGuides([]);
        endGesture();
    };

    /* ---- the pen ---- */
    const pagePoint = (e: React.PointerEvent<HTMLElement>): [number, number] => {
        const f = frameRef.current!.getBoundingClientRect();
        return [clamp((e.clientX - f.left) / dispW, 0, 1), clamp((e.clientY - f.top) / dispH, 0, 1)];
    };
    const penDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setStroke([pagePoint(e)]);
    };
    const penMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!stroke) return;
        const p = pagePoint(e);
        const last = stroke[stroke.length - 1];
        if (Math.hypot((p[0] - last[0]) * dispW, (p[1] - last[1]) * dispH) < 2) return;
        setStroke([...stroke, p]);
    };
    const penUp = () => {
        if (!stroke) return;
        const pts = stroke.length === 1 ? [stroke[0], [stroke[0][0] + 0.0005, stroke[0][1]] as [number, number]] : stroke;
        const o = newDrawOverlay(pts, pen.color, pen.width, pen.opacity);
        setStroke(null);
        if (o) {
            set([...ref.current, o]);
            setSelId(null);
        }
    };

    /* ---- keyboard ---- */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !(t as HTMLInputElement).type?.match(/range|color|checkbox/));
            if (e.key === 'Escape') {
                e.preventDefault();
                if (typing) (t as HTMLElement).blur();
                else if (tool === 'pen') setTool('select');
                else onCancel();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) {
                e.preventDefault();
                redo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !typing) {
                e.preventDefault();
                duplicate();
            } else if (!typing && sel?.type === 'text' && !sel.locked && e.key === 'Enter') {
                e.preventDefault();
                setEditingId(sel.id);
            } else if (!typing && onGo && pageNo !== undefined && pageCount !== undefined && (e.key === 'PageUp' || e.key === 'PageDown')) {
                e.preventDefault();
                const delta = e.key === 'PageUp' ? -1 : 1;
                if (pageNo + delta >= 1 && pageNo + delta <= pageCount) onGo(ref.current, delta);
            } else if (!typing && sel && !sel.locked && (e.key === 'Delete' || e.key === 'Backspace')) {
                e.preventDefault();
                remove();
            } else if (!typing && sel && !sel.locked && e.key.startsWith('Arrow')) {
                e.preventDefault();
                const k = e.shiftKey ? 0.02 : 0.004;
                patch(sel.id, { x: sel.x + (e.key === 'ArrowRight' ? k : e.key === 'ArrowLeft' ? -k : 0), y: sel.y + (e.key === 'ArrowDown' ? k : e.key === 'ArrowUp' ? -k : 0) }, true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }); // eslint-disable-line react-hooks/exhaustive-deps

    const text = sel?.type === 'text' ? sel : null;
    const image = sel?.type === 'image' ? sel : null;
    const shape = sel?.type === 'shape' ? sel : null;
    const doodle = sel?.type === 'draw' ? sel : null;
    const handles: Handle[] = sel?.locked ? [] : sel?.type === 'text' ? ['nw', 'ne', 'se', 'sw', 'w', 'e', 'rot'] : sel?.type === 'shape' ? ['nw', 'ne', 'se', 'sw', 'n', 's', 'w', 'e', 'rot'] : ['nw', 'ne', 'se', 'sw', 'rot'];

    const dragStart = (p: Payload) => (e: React.DragEvent<HTMLElement>) => {
        e.dataTransfer.setData(PW_MIME, JSON.stringify(p));
        e.dataTransfer.effectAllowed = 'copy';
    };
    const dropAt = (e: React.DragEvent<HTMLElement>) => {
        const f = frameRef.current?.getBoundingClientRect();
        return f && f.width > 0 ? { x: clamp((e.clientX - f.left) / f.width, 0, 1), y: clamp((e.clientY - f.top) / f.height, 0, 1) } : undefined;
    };
    const filterPreset = (o: Partial<Overlay>) => image && patch(image.id, { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, ...o } as Partial<Overlay>, true);

    /* ---- pieces of the panels ---- */
    const tile = (key: string, label: string, p: Payload, content: React.ReactNode, cls = 'rd-lib-tile') => (
        <button key={key} type="button" className={cls} draggable onDragStart={dragStart(p)} onClick={() => addFromPayload(p)} aria-label={`Add ${label}`} title={`${label} — click or drag onto the page`}>
            {content}
        </button>
    );

    const selectionTools = sel && (
        <div className="rd-ied-controls">
            <p className="rd-ied-h">
                {labelOf(sel)}
                {sel.locked && <Lock size={13} aria-label="Locked" />}
            </p>
            <div className="rd-chips" role="toolbar" aria-label="Arrange">
                <button type="button" className="rd-btn" onClick={() => reorderId(sel.id, 'front')} aria-label="Bring to front" title="Bring to front">
                    <BringToFront size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => reorderId(sel.id, 'up')} aria-label="Forward" title="Forward">
                    <ChevronUp size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => reorderId(sel.id, 'down')} aria-label="Backward" title="Backward">
                    <ChevronDown size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => reorderId(sel.id, 'back')} aria-label="Send to back" title="Send to back">
                    <SendToBack size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
            </div>
            <div className="rd-chips" role="toolbar" aria-label="Align to the page">
                <button type="button" className="rd-btn" onClick={() => align('left')} aria-label="Align to the left" title="Left">
                    <AlignHorizontalJustifyStart size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => align('center')} aria-label="Centre across the page" title="Centre">
                    <AlignHorizontalJustifyCenter size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => align('right')} aria-label="Align to the right" title="Right">
                    <AlignHorizontalJustifyEnd size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => align('top')} aria-label="Align to the top" title="Top">
                    <AlignVerticalJustifyStart size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => align('middle')} aria-label="Centre down the page" title="Middle">
                    <AlignVerticalJustifyCenter size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => align('bottom')} aria-label="Align to the bottom" title="Bottom">
                    <AlignVerticalJustifyEnd size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
            </div>
            <div className="rd-chips" role="toolbar" aria-label="Selected item">
                <button type="button" className="rd-btn" onClick={() => turn(-15)} aria-label="Turn left 15 degrees" title="Turn left 15°">
                    <RotateCcw size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" onClick={() => turn(15)} aria-label="Turn right 15 degrees" title="Turn right 15°">
                    <RotateCw size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                {image && (
                    <>
                        <button type="button" className="rd-btn" data-on={!!image.flipX} aria-pressed={!!image.flipX} onClick={() => patch(image.id, { flipX: !image.flipX }, true)} aria-label="Flip left to right" title="Flip left to right">
                            <FlipHorizontal2 size={17} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button type="button" className="rd-btn" data-on={!!image.flipY} aria-pressed={!!image.flipY} onClick={() => patch(image.id, { flipY: !image.flipY }, true)} aria-label="Flip top to bottom" title="Flip top to bottom">
                            <FlipVertical2 size={17} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                    </>
                )}
                <button type="button" className="rd-btn" onClick={duplicate} aria-label="Duplicate" title="Duplicate (Ctrl+D)">
                    <Copy size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn" data-on={!!sel.locked} aria-pressed={!!sel.locked} onClick={() => patch(sel.id, { locked: !sel.locked }, true)} aria-label={sel.locked ? 'Unlock' : 'Lock'} title={sel.locked ? 'Unlock' : 'Lock in place'}>
                    {sel.locked ? <Lock size={17} strokeWidth={1.75} aria-hidden="true" /> : <Unlock size={17} strokeWidth={1.75} aria-hidden="true" />}
                </button>
                <button type="button" className="rd-btn rd-danger" onClick={remove} aria-label="Delete this item" title="Delete (Del)">
                    <Trash2 size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
            </div>

            {(image || shape || doodle) && (
                <Slider label="Opacity" value={Math.round((image?.opacity ?? shape?.opacity ?? doodle?.opacity ?? 1) * 100)} min={5} max={100} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(sel.id, { opacity: v / 100 })} />
            )}
            {text && <Slider label="Opacity" value={Math.round((text.opacity ?? 1) * 100)} min={5} max={100} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(text.id, { opacity: v / 100 })} />}
            <div className="rd-chips">
                <button type="button" className="rd-btn rd-wide" data-on={!!sel.shadow} aria-pressed={!!sel.shadow} onClick={() => patch(sel.id, { shadow: !sel.shadow }, true)}>
                    Shadow
                </button>
            </div>

            {image && (
                <>
                    <p className="rd-ied-h">Filters</p>
                    <div className="rd-chips">
                        <button type="button" className="rd-btn rd-wide" onClick={() => filterPreset({})}>
                            Original
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={() => filterPreset({ grayscale: 100, contrast: 110 })}>
                            Black &amp; white
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={() => filterPreset({ sepia: 55, contrast: 105 })}>
                            Warm
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={() => filterPreset({ saturate: 150, contrast: 112 })}>
                            Vivid
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={() => filterPreset({ contrast: 85, brightness: 112, saturate: 90 })}>
                            Fade
                        </button>
                    </div>
                    <Slider label="Brightness" value={image.brightness ?? 100} min={40} max={180} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(image.id, { brightness: v })} />
                    <Slider label="Contrast" value={image.contrast ?? 100} min={40} max={180} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(image.id, { contrast: v })} />
                    <Slider label="Saturation" value={image.saturate ?? 100} min={0} max={200} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(image.id, { saturate: v })} />
                    <Slider label="Blur" value={image.blur ?? 0} min={0} max={100} onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(image.id, { blur: v })} />
                    <Slider label="Corners" value={Math.round((image.radius ?? 0) * 100)} min={0} max={50} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(image.id, { radius: v / 100 })} />
                    <div className="rd-chips">
                        <button type="button" className="rd-btn rd-wide" data-on={!!image.borderColor} aria-pressed={!!image.borderColor} onClick={() => patch(image.id, image.borderColor ? { borderColor: null } : { borderColor: '#ffffff', borderWidth: image.borderWidth || 0.012 }, true)}>
                            Frame
                        </button>
                        {image.borderColor && <ColorField label="Frame colour" value={image.borderColor} onChange={(v) => patch(image.id, { borderColor: v }, true)} />}
                    </div>
                    {image.borderColor && <Slider label="Frame size" value={Math.round((image.borderWidth ?? 0.012) * 1000) / 10} min={0.2} max={5} step={0.1} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(image.id, { borderWidth: v / 100 })} />}
                </>
            )}

            {shape && (
                <>
                    <p className="rd-ied-h">Shape</p>
                    <div className="rd-chips">
                        {shape.kind !== 'line' && shape.kind !== 'arrow' && (
                            <>
                                <button type="button" className="rd-btn rd-wide" data-on={!!shape.fill} aria-pressed={!!shape.fill} onClick={() => patch(shape.id, { fill: shape.fill ? null : '#6f8f6b' }, true)}>
                                    Fill
                                </button>
                                {shape.fill && <ColorField label="Fill colour" value={shape.fill} onChange={(v) => patch(shape.id, { fill: v }, true)} />}
                            </>
                        )}
                        <button type="button" className="rd-btn rd-wide" data-on={!!shape.stroke} aria-pressed={!!shape.stroke} onClick={() => patch(shape.id, { stroke: shape.stroke ? null : '#222222', strokeWidth: shape.strokeWidth || 0.005 }, true)}>
                            Outline
                        </button>
                        {shape.stroke && <ColorField label="Outline colour" value={shape.stroke} onChange={(v) => patch(shape.id, { stroke: v }, true)} />}
                    </div>
                    {shape.stroke && <Slider label="Line size" value={Math.round(shape.strokeWidth * 1000) / 10} min={0.1} max={3} step={0.1} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(shape.id, { strokeWidth: v / 100 })} />}
                    {shape.kind === 'rect' && <Slider label="Corners" value={Math.round(shape.radius * 100)} min={0} max={50} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(shape.id, { radius: v / 100 })} />}
                </>
            )}

            {doodle && (
                <>
                    <p className="rd-ied-h">Pen</p>
                    <div className="rd-chips">
                        <ColorField label="Colour" value={doodle.color} onChange={(v) => patch(doodle.id, { color: v }, true)} />
                    </div>
                    <Slider label="Size" value={Math.round(doodle.width * 1000) / 10} min={0.1} max={4} step={0.1} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(doodle.id, { width: v / 100 })} />
                </>
            )}

            {text && (
                <>
                    <p className="rd-ied-h">Text</p>
                    <textarea
                        ref={textRef}
                        className="rd-text"
                        rows={3}
                        value={text.text}
                        aria-label="Text"
                        placeholder="Type or paste your text"
                        onFocus={startGesture}
                        onBlur={endGesture}
                        onChange={(e) => patch(text.id, { text: e.target.value.slice(0, 4000) })}
                    />
                    <Slider label="Size" value={Math.round(text.size * 1000) / 10} min={1} max={20} step={0.5} suffix="%" onStart={startGesture} onEnd={endGesture} onChange={(v) => patch(text.id, { size: v / 100 })} />
                    <div className="rd-chips">
                        <ColorField label="Colour" value={text.color} onChange={(v) => patch(text.id, { color: v }, true)} />
                        <button type="button" className="rd-btn" data-on={text.bold} aria-pressed={text.bold} onClick={() => patch(text.id, { bold: !text.bold }, true)} aria-label="Bold" title="Bold">
                            <Bold size={17} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button type="button" className="rd-btn" data-on={text.italic} aria-pressed={text.italic} onClick={() => patch(text.id, { italic: !text.italic }, true)} aria-label="Italic" title="Italic">
                            <Italic size={17} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button type="button" className="rd-btn" data-on={!!text.underline} aria-pressed={!!text.underline} onClick={() => patch(text.id, { underline: !text.underline }, true)} aria-label="Underline" title="Underline">
                            <Underline size={17} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="rd-chips">
                        {(['left', 'center', 'right'] as const).map((a) => (
                            <button key={a} type="button" className="rd-btn" data-on={text.align === a} aria-pressed={text.align === a} onClick={() => patch(text.id, { align: a }, true)} aria-label={`Align ${a}`}>
                                {a === 'left' ? <AlignLeft size={16} strokeWidth={1.75} aria-hidden="true" /> : a === 'center' ? <AlignCenter size={16} strokeWidth={1.75} aria-hidden="true" /> : <AlignRight size={16} strokeWidth={1.75} aria-hidden="true" />}
                            </button>
                        ))}
                        <select className="rd-text rd-select" value={text.font} aria-label="Font" onChange={(e) => patch(text.id, { font: e.target.value as TextFont }, true)}>
                            {(Object.keys(FONT_LABELS) as TextFont[]).map((f) => (
                                <option key={f} value={f}>
                                    {FONT_LABELS[f]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="rd-chips">
                        <button type="button" className="rd-btn rd-wide" data-on={!!text.background} aria-pressed={!!text.background} onClick={() => patch(text.id, { background: text.background ? null : '#fff59d' }, true)}>
                            Background
                        </button>
                        {text.background && <ColorField label="Box colour" value={text.background} onChange={(v) => patch(text.id, { background: v }, true)} />}
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="rd-ied rd-ied-canva" role="dialog" aria-label="Add pictures, text and shapes to this page">
            <div className="rd-ied-top">
              <LiquidGlass width="100%" height="auto" radius={28} blur={4} className="rd-ied-glass">
                <div className="rd-ied-toprow">
                <button type="button" className="rd-btn rd-wide" onClick={onCancel}>
                    Cancel
                </button>
                <div className="rd-ied-mid">
                    {onGo && pageNo !== undefined && pageCount !== undefined && (
                        <>
                            <button type="button" className="rd-btn" onClick={() => onGo(ref.current, -1)} disabled={pageNo <= 1} aria-label="Previous page" title="Previous page (Page Up)">
                                <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <span className="rd-ied-pageno" aria-live="polite">
                                {pageNo} / {pageCount}
                            </span>
                            <button type="button" className="rd-btn" onClick={() => onGo(ref.current, 1)} disabled={pageNo >= pageCount} aria-label="Next page" title="Next page (Page Down)">
                                <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <span className="rd-ied-sep" aria-hidden="true" />
                        </>
                    )}
                    <button type="button" className="rd-btn" onClick={undo} disabled={past.current.length === 0} aria-label="Undo" title="Undo (Ctrl+Z)">
                        <Undo2 size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className="rd-btn" onClick={redo} disabled={future.current.length === 0} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                        <Redo2 size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <span className="rd-ied-sep" aria-hidden="true" />
                    <button type="button" className="rd-btn" onClick={() => setZoom((z) => z / 1.25)} disabled={zoom <= 0.25} aria-label="Zoom out" title="Zoom out">
                        <ZoomOut size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className="rd-btn rd-wide rd-zoomval" onClick={() => setZoom(1)} title="Fit the page (pinch or Ctrl + scroll to zoom)">
                        {Math.round(zoom * 100)}%
                    </button>
                    <button type="button" className="rd-btn" onClick={() => setZoom((z) => z * 1.25)} disabled={zoom >= 4} aria-label="Zoom in" title="Zoom in">
                        <ZoomIn size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    {onDeletePage && (pageCount ?? 0) > 1 && (
                        <>
                            <span className="rd-ied-sep" aria-hidden="true" />
                            <button
                                type="button"
                                className="rd-btn rd-wide rd-danger"
                                data-on={confirmDel}
                                onClick={() => {
                                    if (confirmDel) onDeletePage();
                                    else setConfirmDel(true);
                                }}
                                title="Delete this whole page from the book"
                            >
                                <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /> {confirmDel ? 'Tap again to delete' : 'Delete page'}
                            </button>
                        </>
                    )}
                </div>
                <button type="button" className="rd-btn rd-wide rd-accent" data-on="true" onClick={() => onApply(ref.current)}>
                    Apply
                </button>
                </div>
              </LiquidGlass>
            </div>

            <div className="rd-ied-body">
                {/* ---------------- left: editing tools ---------------- */}
                <aside className="rd-ied-left" aria-label="Editing tools">
                  <LiquidGlass width="100%" height="100%" radius={28} blur={4} className="rd-ied-glass">
                    <div className="rd-ied-scroll">
                    <div className="rd-chips" role="toolbar" aria-label="Tools">
                        <button type="button" className="rd-btn rd-wide" data-on={tool === 'select'} aria-pressed={tool === 'select'} onClick={() => setTool('select')}>
                            <MousePointer2 size={16} strokeWidth={1.75} aria-hidden="true" /> Select
                        </button>
                        <button type="button" className="rd-btn rd-wide" data-on={tool === 'pen'} aria-pressed={tool === 'pen'} onClick={() => { setTool('pen'); setSelId(null); }}>
                            <Pencil size={16} strokeWidth={1.75} aria-hidden="true" /> Draw
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={() => addText('Text', {}, undefined, true)}>
                            <TypeIcon size={16} strokeWidth={1.75} aria-hidden="true" /> Text
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={() => void pasteFromButton()} title="Paste text or a picture from the clipboard (Ctrl+V)">
                            Paste
                        </button>
                    </div>

                    {tool === 'pen' && (
                        <div className="rd-ied-controls">
                            <p className="rd-ied-h">Pen</p>
                            <div className="rd-chips">
                                <ColorField label="Colour" value={pen.color} onChange={(v) => setPen((p) => ({ ...p, color: v }))} />
                                {['#222222', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#9c36b5', '#ffffff'].map((c) => (
                                    <button key={c} type="button" className="rd-swatch" style={{ background: c }} data-on={pen.color === c} onClick={() => setPen((p) => ({ ...p, color: c }))} aria-label={`Pen colour ${c}`} />
                                ))}
                            </div>
                            <Slider label="Size" value={Math.round(pen.width * 1000) / 10} min={0.1} max={4} step={0.1} suffix="%" onStart={() => undefined} onEnd={() => undefined} onChange={(v) => setPen((p) => ({ ...p, width: v / 100 }))} />
                            <Slider label="Opacity" value={Math.round(pen.opacity * 100)} min={10} max={100} suffix="%" onStart={() => undefined} onEnd={() => undefined} onChange={(v) => setPen((p) => ({ ...p, opacity: v / 100 }))} />
                            <p className="rd-hint">Draw on the page with your finger, pen or mouse. Switch to Select to move or change a drawing.</p>
                        </div>
                    )}

                    {message && (
                        <p className="rd-error" role="alert">
                            {message}
                        </p>
                    )}

                    {tool === 'select' && selectionTools}
                    {tool === 'select' && !sel && <p className="rd-hint">Pick something from the library on the right, or drag it onto the page. Tap an item on the page to change it; double-click text (or press Enter) to type straight on the page. You can also paste (Ctrl+V) or drop pictures on the page.</p>}

                    <div className="rd-ied-controls">
                        <p className="rd-ied-h">
                            <Layers size={14} strokeWidth={1.75} aria-hidden="true" /> Layers
                        </p>
                        {overlays.length === 0 && <p className="rd-hint">Nothing on this page yet.</p>}
                        <ul className="rd-layers">
                            {[...overlays].reverse().map((o) => (
                                <li key={o.id} data-sel={o.id === selId}>
                                    <button type="button" className="rd-layer-name" onClick={() => { setSelId(o.id); setTool('select'); }}>
                                        {labelOf(o)}
                                    </button>
                                    <button type="button" className="rd-layer-btn" onClick={() => reorderId(o.id, 'up')} aria-label="Move up" title="Move up">
                                        <ChevronUp size={15} strokeWidth={1.75} aria-hidden="true" />
                                    </button>
                                    <button type="button" className="rd-layer-btn" onClick={() => reorderId(o.id, 'down')} aria-label="Move down" title="Move down">
                                        <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" />
                                    </button>
                                    <button type="button" className="rd-layer-btn" data-on={!!o.locked} onClick={() => patch(o.id, { locked: !o.locked }, true)} aria-label={o.locked ? 'Unlock' : 'Lock'} title={o.locked ? 'Unlock' : 'Lock'}>
                                        {o.locked ? <Lock size={15} strokeWidth={1.75} aria-hidden="true" /> : <Unlock size={15} strokeWidth={1.75} aria-hidden="true" />}
                                    </button>
                                    <button type="button" className="rd-layer-btn" onClick={() => removeId(o.id)} aria-label="Delete" title="Delete">
                                        <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    </div>
                  </LiquidGlass>
                </aside>

                {/* ---------------- middle: the page ---------------- */}
                <div
                    ref={stageRef}
                    className="rd-ied-stage"
                    onPointerDown={() => setSelId(null)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const at = dropAt(e);
                        const raw = e.dataTransfer.getData(PW_MIME);
                        if (raw) {
                            try {
                                addFromPayload(JSON.parse(raw) as Payload, at);
                            } catch {
                                /* not ours */
                            }
                            return;
                        }
                        void addFiles(Array.from(e.dataTransfer.files ?? []), at);
                    }}
                >
                    {failed && <p className="rd-error">This page could not be shown.</p>}
                    <div ref={frameRef} className="rd-ied-frame" style={{ width: dispW, height: dispH }} onPointerDown={(e) => e.stopPropagation()}>
                        <canvas ref={baseRef} style={{ width: dispW, height: dispH }} onPointerDown={() => setSelId(null)} />
                        <OverlayLayer overlays={overlays} skipId={editingId} />
                        <div className="rd-ovl-layer">
                            {overlays.map((o) => {
                                const b = overlayBox(o, dispW, dispH);
                                const selected = o.id === selId;
                                return (
                                    <div
                                        key={o.id}
                                        className="rd-ovl"
                                        data-sel={selected}
                                        data-type={o.type}
                                        data-locked={!!o.locked}
                                        style={{ left: o.x * dispW, top: o.y * dispH, width: b.width, height: b.height, transform: `rotate(${o.rotation}deg)`, pointerEvents: tool === 'pen' ? 'none' : undefined }}
                                        onPointerDown={down(o, 'move')}
                                        onPointerMove={move}
                                        onPointerUp={up}
                                        onPointerCancel={up}
                                        onDoubleClick={() => {
                                            if (o.type === 'text' && !o.locked) setEditingId(o.id);
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={o.type === 'text' ? `Text: ${o.text.slice(0, 40)}` : labelOf(o)}
                                        onFocus={() => setSelId(o.id)}
                                    >
                                        {o.type === 'text' && editingId === o.id && selected && (
                                            <textarea
                                                className="rd-inline-text"
                                                value={o.text}
                                                aria-label="Edit text on the page"
                                                spellCheck={false}
                                                ref={(el) => {
                                                    if (el && document.activeElement !== el) {
                                                        el.focus();
                                                        el.select();
                                                    }
                                                }}
                                                style={{
                                                    font: fontString(o, Math.max(4, o.size * dispH)),
                                                    lineHeight: 1.28,
                                                    padding: Math.max(4, o.size * dispH) * 0.28,
                                                    color: o.color,
                                                    textAlign: o.align,
                                                    background: o.background ?? 'transparent',
                                                    opacity: o.opacity ?? 1,
                                                }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onDoubleClick={(e) => e.stopPropagation()}
                                                onFocus={startGesture}
                                                onBlur={() => {
                                                    endGesture();
                                                    setEditingId(null);
                                                }}
                                                onChange={(e) => patch(o.id, { text: e.target.value.slice(0, 4000) })}
                                            />
                                        )}
                                        {selected &&
                                            handles.map((h) => (
                                                <div key={h} className={h === 'rot' ? 'rd-ovl-rot' : 'rd-ovl-h'} data-h={h} onPointerDown={down(o, h)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
                                            ))}
                                    </div>
                                );
                            })}
                        </div>
                        {guides.map((g) => (
                            <div key={`${g.axis}${g.pos}`} className="rd-guide" data-axis={g.axis} style={g.axis === 'v' ? { left: `${g.pos * 100}%` } : { top: `${g.pos * 100}%` }} />
                        ))}
                        {tool === 'pen' && (
                            <div className="rd-draw-catch" onPointerDown={penDown} onPointerMove={penMove} onPointerUp={penUp} onPointerCancel={penUp}>
                                {stroke && (
                                    <svg width={dispW} height={dispH} viewBox={`0 0 ${dispW} ${dispH}`} aria-hidden="true">
                                        <polyline points={stroke.map(([x, y]) => `${x * dispW},${y * dispH}`).join(' ')} fill="none" stroke={pen.color} strokeOpacity={pen.opacity} strokeWidth={Math.max(1, pen.width * dispW)} strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ---------------- right: the library ---------------- */}
                <aside className="rd-ied-right" aria-label="Library">
                  <LiquidGlass width="100%" height="100%" radius={28} blur={4} className="rd-ied-glass">
                    <div className="rd-ied-rightin">
                    <div className="rd-lib-tabs" role="tablist" aria-label="Library">
                        {(
                            [
                                ['uploads', 'Uploads', <Upload key="u" size={15} strokeWidth={1.75} aria-hidden="true" />],
                                ['photos', 'Photos', <ImageIcon key="p" size={15} strokeWidth={1.75} aria-hidden="true" />],
                                ['elements', 'Elements', <Shapes key="e" size={15} strokeWidth={1.75} aria-hidden="true" />],
                                ['text', 'Text', <TypeIcon key="t" size={15} strokeWidth={1.75} aria-hidden="true" />],
                                ['background', 'Background', <Palette key="b" size={15} strokeWidth={1.75} aria-hidden="true" />],
                            ] as [Tab, string, React.ReactNode][]
                        ).map(([id, label, icon]) => (
                            <button key={id} type="button" role="tab" aria-selected={tab === id} data-on={tab === id} className="rd-lib-tab" onClick={() => setTab(id)}>
                                {icon}
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="rd-lib-body" role="tabpanel">
                        {tab === 'uploads' && (
                            <>
                                <button type="button" className="rd-btn rd-wide rd-accent rd-lib-upload" onClick={() => fileRef.current?.click()} disabled={busy}>
                                    <Upload size={16} strokeWidth={1.75} aria-hidden="true" /> {busy ? 'Adding…' : 'Upload anything'}
                                </button>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    multiple
                                    hidden
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files ?? []);
                                        e.target.value = '';
                                        if (files.length) void addFiles(files, undefined, false);
                                    }}
                                />
                                {lib.length === 0 ? (
                                    <p className="rd-hint">Upload anything: pictures (PNG, JPG, SVG, GIF, WebP …), PDFs (each page becomes a picture), code or text files, or any other file. They show up here. Click one or drag it onto the page. You can also paste (Ctrl+V) or drop files on the page.</p>
                                ) : (
                                    <div className="rd-lib-grid">
                                        {lib.map((l) =>
                                            l.kind === 'image'
                                                ? tile(l.id, l.src.name || 'picture', { k: 'lib', id: l.id }, <img src={l.url} alt="" draggable={false} />, 'rd-lib-tile rd-lib-photo')
                                                : tile(
                                                      l.id,
                                                      l.name,
                                                      { k: 'lib', id: l.id },
                                                      <span className="rd-lib-file">
                                                          <b>{l.name}</b>
                                                          <small>{l.kind === 'text' ? l.text.slice(0, 90) : 'File label'}</small>
                                                      </span>,
                                                      'rd-lib-tile rd-lib-photo rd-lib-filetile'
                                                  )
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {tab === 'photos' && (
                            <>
                                <p className="rd-hint">Free photos from picsum.photos. Click or drag one onto the page. Needs an internet connection.</p>
                                <div className="rd-lib-grid">
                                    {PHOTOS.map((id) => tile(`ph${id}`, 'photo', { k: 'photo', id }, <img src={`https://picsum.photos/id/${id}/240/180`} alt="" loading="lazy" draggable={false} />, 'rd-lib-tile rd-lib-photo'))}
                                </div>
                            </>
                        )}

                        {tab === 'elements' && (
                            <>
                                <p className="rd-ied-h">Shapes</p>
                                <div className="rd-lib-grid rd-lib-small">{SHAPES.map((s) => tile(s.kind, s.label, { k: 'shape', kind: s.kind }, <ShapeIcon d={s.d} line={s.line} />))}</div>
                                <p className="rd-ied-h">
                                    <Smile size={14} strokeWidth={1.75} aria-hidden="true" /> Stickers
                                </p>
                                <div className="rd-lib-grid rd-lib-small">{EMOJI.map((ch) => tile(ch, ch, { k: 'emoji', ch }, <span className="rd-emoji">{ch}</span>))}</div>
                            </>
                        )}

                        {tab === 'text' && (
                            <div className="rd-lib-list">
                                {TEXT_STYLES.map((st, i) => (
                                    <button key={st.label} type="button" className="rd-lib-text" draggable onDragStart={dragStart({ k: 'text', i })} onClick={() => addFromPayload({ k: 'text', i })} title="Click or drag onto the page">
                                        <span
                                            style={{
                                                fontFamily: st.patch.font === 'serif' ? 'Georgia, serif' : st.patch.font === 'mono' ? 'ui-monospace, Menlo, monospace' : undefined,
                                                fontWeight: st.patch.bold ? 700 : 400,
                                                fontStyle: st.patch.italic ? 'italic' : 'normal',
                                                fontSize: Math.round(12 + (st.patch.size ?? 0.035) * 160),
                                                background: st.patch.background ?? undefined,
                                                color: st.patch.color,
                                                padding: st.patch.background ? '2px 8px' : undefined,
                                                borderRadius: 6,
                                            }}
                                        >
                                            {st.sample}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {tab === 'background' && (
                            <>
                                <p className="rd-hint">Cover the page with a colour. It goes behind everything and stays locked until you unlock it in Layers.</p>
                                <div className="rd-lib-grid rd-lib-small">
                                    {BACKGROUNDS.map((c) => (
                                        <button key={c} type="button" className="rd-lib-tile rd-lib-color" style={{ background: c }} onClick={() => setBackground(c)} aria-label={`Background ${c}`} title={c} />
                                    ))}
                                </div>
                                <label className="rd-field rd-color">
                                    <span className="rd-label">Any colour</span>
                                    <input type="color" defaultValue="#ffffff" onChange={(e) => setBackground(e.target.value)} />
                                </label>
                                <button type="button" className="rd-btn rd-wide" onClick={() => setBackground(null)} disabled={!overlays.some((o) => o.type === 'shape' && o.isBackground)}>
                                    Remove background colour
                                </button>
                            </>
                        )}
                    </div>
                    </div>
                  </LiquidGlass>
                </aside>
            </div>
        </div>
    );
}
