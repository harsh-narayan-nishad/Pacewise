'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
    Eye,
    EyeOff,
    FilePlus2,
    FileText,
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
    X,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';

import LiquidGlass from '@/components/FlipReader/ui/LiquidGlass';
import { fileToImageSource, getBitmap, renderEdit, toBlob } from '@/lib/flipreader/imageops';
import { openPdfSource } from '@/lib/flipreader/loaders';
import { drawOverlays, FONT_LABELS, fontString, newBackgroundOverlay, newDrawOverlay, newImageOverlay, newShapeOverlay, newTextOverlay, overlayBox } from '@/lib/flipreader/overlays';
import { newId } from '@/lib/flipreader/pages';
import type { ImageSource, Overlay, PageItem, ShapeKind, TextFont, TextOverlay } from '@/lib/flipreader/types';
import { OverlayLayer } from './OverlayLayer';
import { useRouter } from 'next/navigation';
import { useReadingDispatch } from '@/contexts/ReadingContext';
import { startSwitchLoader } from '@/lib/switchLoader';
import { BRAND_NAME } from '@/lib/brand';
import MagicBento, { DEFAULT_ITEMS as DEFAULT_BENTO_ITEMS } from '@/components/ui/MagicBento';
import { StoryTextEditor, clearEditorDraft } from '@/components/Editor/StoryTextEditor';
import { RichDocument, defaultMeta } from '@/lib/editor/model/RichDocument';
import { pageToDocHtml } from '@/lib/flipreader/pageToDoc';
import { elementToPageImages } from '@/lib/flipreader/domToImage';
import { MediconnectSpinner } from '@/components/ui/loaders/MediconnectSpinner';

type Handle = 'nw' | 'ne' | 'se' | 'sw' | 'w' | 'e' | 'n' | 's' | 'rot';

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const BASE_SIDE = 1600; // resolution of the page shown in the editor
/** height taken by the page bar above the page and the Add page bar under it (with their gaps) */
const PAGE_CHROME_H = 112;

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
export function PageEditor({ item, onApply, onCancel, pageNo, pageCount, onGo, onDeletePage, onInsertPage, onHidePage, windowPages, onWindowOp, bookRatio, onReplacePage }: { item: PageItem; onApply: (overlays: Overlay[], extraPages?: ImageSource[]) => void; onCancel: () => void; pageNo?: number; pageCount?: number; onGo?: (overlays: Overlay[], delta: number, extraPages?: ImageSource[]) => void; onDeletePage?: () => void; onInsertPage?: (overlays: Overlay[], extraPages: ImageSource[], blank?: ImageSource) => void; onHidePage?: (overlays: Overlay[], hidden: boolean) => void; windowPages?: { item: PageItem; index: number }[]; onWindowOp?: (op: 'hide' | 'show' | 'lock' | 'unlock' | 'duplicate' | 'delete' | 'blank', index: number, blank?: ImageSource) => void; bookRatio?: number; onReplacePage?: (src: ImageSource) => void }) {
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
    /*
     * Document mode: the page canvas becomes the rich text editor (components/Editor, the Google Docs-like one),
     * filled with this page's text (headings, paragraphs and code blocks, see lib/flipreader/pageToDoc). Leaving it,
     * or Apply, draws the document onto the page as one full-page layer, so the text becomes part of the page.
     */
    const [docMode, setDocMode] = useState(false);
    const docModeRef = useRef(false);
    docModeRef.current = docMode;
    const [docInit, setDocInit] = useState<RichDocument | null>(null);
    const docLatest = useRef<RichDocument | null>(null);
    const docLayerId = useRef<string | null>(null);
    /** pages the document runs on to after this one: added after this page on Apply (or when moving to another page) */
    const docExtra = useRef<ImageSource[]>([]);
    const docWrapRef = useRef<HTMLDivElement>(null);
    /** the pages' header, footer and page numbers: none until you add them (double-click a page's top / bottom margin) */
    const [docHf, setDocHf] = useState<DocHf>({ header: '', footer: '', pageNumbers: false });
    /** the document is being put on the page(s): Mediconnect's loader runs in the button that started it */
    const [baking, setBaking] = useState<null | 'apply' | 'back' | 'prev' | 'next' | 'add' | 'dup'>(null);
    const docSlot = `flipbook-page-${item.id}`;
    useEffect(() => {
        setDocMode(false);
        setDocInit(null);
        docLatest.current = null;
        docLayerId.current = null;
        docExtra.current = [];
    }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    /** the page underneath has been drawn (until then Mediconnect's loader shows on the canvas) */
    const [baseReady, setBaseReady] = useState(false);
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
        setBaseReady(false);
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
                setBaseReady(true);
            } catch {
                if (alive) setFailed(true);
            }
        })();
        return () => {
            alive = false;
        };
    }, [item.id, item.type === 'image' ? item.src.id : '']); // eslint-disable-line react-hooks/exhaustive-deps

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

    const fit = Math.min((stage.w - 40) / base.w, (stage.h - 40 - PAGE_CHROME_H) / base.h) || 1;
    const dispW = Math.max(1, base.w * fit * zoom);
    const dispH = Math.max(1, base.h * fit * zoom);
    const pageAspect = base.w / base.h;
    /** height / width of the document's sheets: the book's page shape, so a written page fills a book page */
    const docAspect = bookRatio && bookRatio > 0 ? bookRatio : base.h / Math.max(1, base.w);

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
            if (docModeRef.current) return; // the document editor handles its own pasting
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
            if (docModeRef.current && e.key !== 'Escape') return; // page shortcuts are off while the document is shown
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
                void stepPage(delta as -1 | 1);
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

    /* ---- document mode ---- */
    async function openDoc() {
        setBusy(true);
        setMessage(null);
        try {
            let doc = docLatest.current;
            if (!doc) {
                // a page with no text (a picture or a scanned page) simply opens as an empty document
                const html = await pageToDocHtml(item);
                doc = RichDocument.fromHtml(html ?? '<p></p>', defaultMeta(pageNo ? `Page ${pageNo}` : 'Page'));
                docLatest.current = doc;
            }
            setDocInit(doc);
            setSelId(null);
            setEditingId(null);
            setDocMode(true);
        } catch {
            setMessage('The text of this page could not be read.');
        } finally {
            setBusy(false);
        }
    }

    /**
     * Draws the document onto the page as one locked, full-page layer (under the other layers) and returns the layers.
     * A document longer than one page is split into pages: the first goes on this page, the rest are kept in
     * `docExtra` and added as new pages right after this one on Apply.
     */
    async function bakeDoc(): Promise<Overlay[]> {
        const pageEl = docWrapRef.current?.querySelector<HTMLElement>('.sr-page');
        if (!pageEl) return ref.current;
        // let the editor finish its last change
        await new Promise((r) => setTimeout(r, 220));
        const bg = '#ffffff'; // the sheets are white paper
        // the pages are made in the book's own page shape, so they fill the book's pages edge to edge
        const sheets = { height: pageEl.offsetWidth * docAspect, gap: DOC_SHEET_GAP, count: Number(pageEl.style.getPropertyValue('--pe-pages')) || 1 };
        const [src, ...more] = await elementToPageImages(pageEl, base.w, Math.round(base.w * docAspect), bg, pageNo ? `Page ${pageNo} document` : 'Page document', sheets);
        docExtra.current = more;
        if (more.length) setMessage(`The document runs to ${more.length + 1} pages: the other ${more.length === 1 ? 'page is' : `${more.length} pages are`} added after this one when you apply.`);
        if (onReplacePage) {
            // the document becomes this page itself (not a layer over the old page, which may be a different shape)
            const next = docLayerId.current ? ref.current.filter((o) => o.id !== docLayerId.current) : ref.current;
            docLayerId.current = null;
            if (next !== ref.current) set(next);
            onReplacePage(src);
            return next;
        }
        const id = docLayerId.current ?? newId();
        docLayerId.current = id;
        const layer: Overlay = { id, type: 'image', src, x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, locked: true };
        const next = [layer, ...ref.current.filter((o) => o.id !== id)];
        set(next);
        return next;
    }

    async function leaveDoc(from: 'apply' | 'back' | 'prev' | 'next' | 'add' | 'dup' = 'back'): Promise<Overlay[] | null> {
        setBusy(true);
        setBaking(from);
        setMessage(null);
        try {
            // at least 0.6 s on screen, like the app's other Mediconnect loaders, so it never just flashes
            const [next] = await Promise.all([bakeDoc(), new Promise((r) => setTimeout(r, 600))]);
            setDocMode(false);
            return next;
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'The document could not be put on the page.');
            return null;
        } finally {
            setBusy(false);
            setBaking(null);
        }
    }

    /** A white page the size of this one, for "Add page". */
    async function blankPage(): Promise<ImageSource> {
        const c = document.createElement('canvas');
        c.width = base.w > 1 ? base.w : 1240;
        c.height = base.h > 1 ? base.h : 1754;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        const blob: Blob = await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('The new page could not be made.'))), 'image/png'));
        return { id: newId(), kind: 'image', name: 'Blank page', blob, width: c.width, height: c.height };
    }

    /** "Add page" (a blank page) or "Duplicate page" (a copy of this one): keeps this page's work, then opens the new page. */
    async function insertPage(kind: 'blank' | 'copy') {
        if (!onInsertPage) return;
        let layers = ref.current;
        if (docModeRef.current) {
            const next = await leaveDoc(kind === 'blank' ? 'add' : 'dup');
            if (!next) return;
            layers = next;
        }
        onInsertPage(layers, docExtra.current, kind === 'blank' ? await blankPage() : undefined);
    }

    /**
     * Page bar ↑ / ↓: go to the previous / next page in the editor (this page's work is kept). It only moves through the
     * pages; the order of the pages in the PDF is not changed.
     */
    async function stepPage(dir: -1 | 1) {
        // only through the window's own pages, never into the rest of the PDF
        const target = windowList[windowPos + dir];
        if (target) await stepTo(target.index - here);
    }

    /** Opens another page of the window (clicked in the stack) for editing; this page's work is kept. */
    async function openPage(index: number) {
        const here = (pageNo ?? 1) - 1;
        if (index !== here) await stepTo(index - here);
    }
    async function stepTo(delta: number) {
        if (!onGo || delta === 0) return;
        if (docModeRef.current) {
            const next = await leaveDoc(delta < 0 ? 'prev' : 'next');
            if (next) onGo(next, delta, docExtra.current);
            return;
        }
        onGo(ref.current, delta, docExtra.current);
    }
    const here = (pageNo ?? 1) - 1;
    /**
     * The window: the page it was opened on and the pages made in it, kept apart from the rest of the PDF (they become
     * part of it only on Apply). Its arrows, page numbers and stack count only these pages.
     */
    const windowList = windowPages && windowPages.some((w) => w.item.id === item.id) ? windowPages : [{ item, index: here }];
    const windowPos = Math.max(0, windowList.findIndex((w) => w.item.id === item.id));
    const stackBefore = windowList.filter((w) => w.index < here);
    const stackAfter = windowList.filter((w) => w.index > here);
    const windowNo = (index: number) => windowList.findIndex((w) => w.index === index) + 1;
    const currentRef = useRef<HTMLDivElement>(null);
    // with other pages above it in the stack, bring the page being edited into view
    useEffect(() => {
        const stageEl = stageRef.current;
        const cur = currentRef.current;
        if (!baseReady || !stageEl || !cur) return;
        stageEl.scrollTop += cur.getBoundingClientRect().top - stageEl.getBoundingClientRect().top - 12;
    }, [baseReady]); // eslint-disable-line react-hooks/exhaustive-deps

    /** Page bar: lock / unlock everything on this page. */
    const allLocked = overlays.length > 0 && overlays.every((o) => o.locked);
    const toggleLockAll = () => {
        if (overlays.length === 0) return;
        set(ref.current.map((o) => ({ ...o, locked: !allLocked })));
        if (!allLocked) setSelId(null);
    };

    const [addMenu, setAddMenu] = useState(false);
    /** the one side panel shows the tools or the library */
    const [panelTab, setPanelTab] = useState<'tools' | 'library'>('tools');
    /** a Library item shown large in the preview window */
    const [preview, setPreview] = useState<Lib | null>(null);
    // Escape closes the preview (and only the preview, not the editor)
    useEffect(() => {
        if (!preview) return undefined;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopImmediatePropagation();
            setPreview(null);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [preview]);

    /* inertia in the preview: the wheel moves a target and the scroll eases toward it, so a flick glides and settles
       (the window itself, or long text inside it, whichever can move) */
    const previewRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const root = previewRef.current;
        if (!preview || !root) return undefined;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
        const glide = new Map<HTMLElement, { target: number; raf: number }>();
        const scrollerFor = (start: EventTarget | null, dy: number): HTMLElement | null => {
            for (let n = start as HTMLElement | null; n; n = n.parentElement) {
                const can = n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY);
                const room = dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1;
                if (can && (room || n === root)) return n;
                if (n === root) break;
            }
            return null;
        };
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            const el = scrollerFor(e.target, e.deltaY);
            if (!el) return;
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? el.clientHeight : 1;
            const max = el.scrollHeight - el.clientHeight;
            let g = glide.get(el);
            if (!g) {
                g = { target: el.scrollTop, raf: 0 };
                glide.set(el, g);
            }
            g.target = clamp(g.target + e.deltaY * unit, 0, max);
            const step = () => {
                const st = glide.get(el);
                if (!st) return;
                const d = st.target - el.scrollTop;
                if (Math.abs(d) < 0.5) {
                    el.scrollTop = st.target;
                    glide.delete(el);
                    return;
                }
                el.scrollTop += d * 0.16;
                st.raf = requestAnimationFrame(step);
            };
            if (!g.raf) g.raf = requestAnimationFrame(step);
        };
        root.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            root.removeEventListener('wheel', onWheel);
            glide.forEach((g) => cancelAnimationFrame(g.raf));
        };
    }, [preview]);
    /** "Pacewise" in the top bar: to the landing page, like the navbar's Pacewise */
    const router = useRouter();
    const readingDispatch = useReadingDispatch();
    const goHome = () => {
        readingDispatch({ type: 'CLEAR_STORY' });
        startSwitchLoader('home', '/');
        router.push('/');
    };
    /** the Library card's buttons: scroll to that section's card and mark it for a moment */
    const [libFocus, setLibFocus] = useState('Uploads');
    const jumpToLib = (from: HTMLElement, label: string) => {
        setLibFocus(label);
        const bento = from.closest('.pe-bento-lib');
        const title = Array.from(bento?.querySelectorAll<HTMLElement>('.magic-bento__card h3') ?? []).find((h) => h.textContent === label);
        const card = title?.closest<HTMLElement>('.magic-bento__card');
        if (!card) return;
        // scroll only the panel itself (scrollIntoView would also move the whole editor screen)
        const panel = card.closest<HTMLElement>('.rd-ied-scroll');
        if (panel) panel.scrollTo({ top: panel.scrollTop + card.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12, behavior: 'smooth' });
        card.classList.remove('pe-lib-flash');
        void card.offsetWidth; // restart the mark
        card.classList.add('pe-lib-flash');
        window.setTimeout(() => card.classList.remove('pe-lib-flash'), 1200);
    };

    /* the left panel can be made narrower or wider by dragging its edge (remembered); double-click resets it */
    const LEFT_KEY = 'pacewise.pageEditor.leftWidth';
    const [leftW, setLeftW] = useState<number | null>(null);
    useEffect(() => {
        try {
            const v = Number(localStorage.getItem(LEFT_KEY));
            if (v > 0) setLeftW(v);
        } catch {
            /* default width */
        }
    }, []);
    const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
        const aside = e.currentTarget.parentElement;
        const body = aside?.parentElement;
        if (!aside || !body) return;
        e.preventDefault();
        const x0 = e.clientX;
        const w0 = aside.getBoundingClientRect().width;
        // keep at least ~360px for the page
        const max = Math.max(260, body.getBoundingClientRect().width - 360 - 30);
        let last = w0;
        const move = (ev: PointerEvent) => {
            last = clamp(w0 + ev.clientX - x0, 240, max);
            setLeftW(last);
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            try {
                localStorage.setItem(LEFT_KEY, String(Math.round(last)));
            } catch {
                /* not remembered */
            }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };
    const resetResize = () => {
        setLeftW(null);
        try {
            localStorage.removeItem(LEFT_KEY);
        } catch {
            /* nothing to forget */
        }
    };

    async function applyAll() {
        if (!docModeRef.current) {
            if (docLatest.current) clearEditorDraft(docSlot);
            onApply(ref.current, docExtra.current);
            return;
        }
        const next = await leaveDoc('apply');
        if (next) {
            clearEditorDraft(docSlot);
            onApply(next, docExtra.current);
        }
    }

    return (
        <div className="rd-ied rd-ied-canva" role="dialog" aria-label="Add pictures, text and shapes to this page">
            {/* Top bar in the landing page navbar's design: Pacewise on the left (home), the page tools in the middle,
                Cancel and Apply on the right */}
            <div className="rd-ied-top pe-nav">
                <div className="pe-nav-left">
                    <button type="button" className="pe-nav-brand" onClick={goHome} aria-label={`${BRAND_NAME} — back to the home page`}>
                        {BRAND_NAME}
                    </button>
                </div>
                <div className="rd-ied-mid">
                    {onGo && pageNo !== undefined && pageCount !== undefined && (
                        <>
                            <button type="button" className="rd-btn" onClick={() => void stepPage(-1)} disabled={windowPos <= 0 || busy} aria-label="Previous page" title="Previous page (Page Up)">
                                {baking === 'prev' ? <ButtonSpinner /> : <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />}
                            </button>
                            <span className="rd-ied-pageno" aria-live="polite">
                                {windowPos + 1} / {windowList.length}
                            </span>
                            <button type="button" className="rd-btn" onClick={() => void stepPage(1)} disabled={windowPos >= windowList.length - 1 || busy} aria-label="Next page" title="Next page (Page Down)">
                                {baking === 'next' ? <ButtonSpinner /> : <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />}
                            </button>
                            <span className="rd-ied-sep" aria-hidden="true" />
                        </>
                    )}
                    <button type="button" className="rd-btn" onClick={undo} disabled={docMode || past.current.length === 0} aria-label="Undo" title="Undo (Ctrl+Z)">
                        <Undo2 size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className="rd-btn" onClick={redo} disabled={docMode || future.current.length === 0} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                        <Redo2 size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <span className="rd-ied-sep" aria-hidden="true" />
                    <button type="button" className="rd-btn" onClick={() => setZoom((z) => z / 1.25)} disabled={docMode || zoom <= 0.25} aria-label="Zoom out" title="Zoom out">
                        <ZoomOut size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className="rd-btn rd-wide rd-zoomval" onClick={() => setZoom(1)} disabled={docMode} title="Fit the page (pinch or Ctrl + scroll to zoom)">
                        {Math.round(zoom * 100)}%
                    </button>
                    <button type="button" className="rd-btn" onClick={() => setZoom((z) => z * 1.25)} disabled={docMode || zoom >= 4} aria-label="Zoom in" title="Zoom in">
                        <ZoomIn size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <span className="rd-ied-sep" aria-hidden="true" />
                    <button
                        type="button"
                        className="rd-btn rd-wide"
                        data-on={docMode}
                        aria-pressed={docMode}
                        disabled={busy}
                        onClick={() => void (docMode ? leaveDoc('back') : openDoc())}
                        title={docMode ? 'Back to the page: the document is put on the page' : 'Edit this page as a document (its text, headings and code)'}
                    >
                        {baking === 'back' ? <ButtonSpinner /> : <FileText size={16} strokeWidth={1.75} aria-hidden="true" />} {docMode ? (baking === 'back' ? 'Adding…' : 'Back to page') : 'Document'}
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
                <div className="pe-nav-right">
                <button type="button" className="rd-btn rd-wide" onClick={onCancel}>
                    Cancel
                </button>
                <button type="button" className="rd-btn rd-wide rd-accent" data-on="true" disabled={busy} aria-busy={baking === 'apply'} onClick={() => void applyAll()}>
                    {baking === 'apply' ? (
                        <>
                            <ButtonSpinner /> Applying…
                        </>
                    ) : (
                        'Apply'
                    )}
                </button>
                </div>
            </div>

            <div className="rd-ied-body" hidden={docMode} style={leftW ? ({ ['--pe-left' as string]: `${leftW}px` } as React.CSSProperties) : undefined}>
                {/* ---------------- left: editing tools ---------------- */}
                <aside className="rd-ied-left" aria-label="Editing tools">
                  <div className="pe-left-resize" role="separator" aria-orientation="vertical" aria-label="Resize the tools panel" title="Drag to resize (double-click to reset)" onPointerDown={startResize} onDoubleClick={resetResize} />
                  <LiquidGlass width="100%" height="100%" radius={28} blur={4} className="rd-ied-glass">
                    <div className="pe-panel">
                    {/* Tools and Library in one panel (the page gets the room the second panel took): switch with
                        the pill, like the landing page's Read / Revise / Share */}
                    <div className="pe-tabs" role="tablist" aria-label="Panel">
                        <button type="button" role="tab" className="pe-tab" aria-selected={panelTab === 'tools'} onClick={() => setPanelTab('tools')}>
                            Tools
                        </button>
                        <button type="button" role="tab" className="pe-tab" aria-selected={panelTab === 'library'} onClick={() => setPanelTab('library')}>
                            Library
                        </button>
                    </div>
                    {panelTab === 'tools' ? (
                    <>
                    <div className="rd-ied-scroll">
                    {/* The editing tools as Magic Bento cards, in the bento's own card design (controls above, title and
                        description below), followed by the bento's own cards. */}
                    <div className="pe-bento">
                        <MagicBento
                            columns={4}
                            rowHeight={200}
                            gap={12}
                            radius={20}
                            enableBorderGlow={false}
                            enableSpotlight={false}
                            spotlightRadius={300}
                            clickEffect
                            enableStars={false}
                            particleCount={24}
                            enableTilt={false}
                            enableMagnetism={false}
                            textAutoHide
                            intro
                            items={[
                                {
                                    id: 'pe-tools',
                                    colSpan: 2,
                                    content: (
                                        <BentoControls title="Tools" description="Select, draw, write or paste on the page">
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

                                        </BentoControls>
                                    ),
                                },
                                {
                                    id: 'pe-layers',
                                    colSpan: 2,
                                    rowSpan: 2,
                                    content: (
                                        <BentoControls title="Layers" description={overlays.length ? `${overlays.length} on this page` : 'Nothing on this page yet'}>
                    <div className="rd-ied-controls">
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

                                        </BentoControls>
                                    ),
                                },
                                {
                                    id: 'pe-context',
                                    colSpan: 2,
                                    rowSpan: 2,
                                    content: (
                                        <BentoControls
                                            title={tool === 'pen' ? 'Pen' : sel ? labelOf(sel) : 'Start here'}
                                            description={tool === 'pen' ? 'Colour, size and opacity' : sel ? 'Change the selected item' : 'Add pictures, text and shapes'}
                                        >
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

                                        </BentoControls>
                                    ),
                                },
                                ...DEFAULT_BENTO_ITEMS,
                            ]}
                        />
                    </div>
                    </div>
                    </>
                    ) : (
                    <>
                    <div className="rd-ied-scroll">
                    {/* The library as Magic Bento cards, arranged like the Tools (controls above, title and description below) */}
                    <div className="pe-bento pe-bento-lib">
                        <MagicBento
                            columns={4}
                            rowHeight={200}
                            gap={12}
                            radius={20}
                            enableBorderGlow={false}
                            enableSpotlight={false}
                            spotlightRadius={300}
                            clickEffect
                            enableStars={false}
                            particleCount={24}
                            enableTilt={false}
                            enableMagnetism={false}
                            textAutoHide
                            intro
                            items={[
                                {
                                    id: 'pe-lib-menu',
                                    colSpan: 2,
                                    content: (
                                        <BentoControls title="Library" description="Uploads, photos, elements, text or a background">
                                            <div className="rd-chips" role="toolbar" aria-label="Library">
                                                {(
                                                    [
                                                        ['Uploads', <Upload key="u" size={16} strokeWidth={1.75} aria-hidden="true" />],
                                                        ['Photos', <ImageIcon key="p" size={16} strokeWidth={1.75} aria-hidden="true" />],
                                                        ['Elements', <Shapes key="e" size={16} strokeWidth={1.75} aria-hidden="true" />],
                                                        ['Text', <TypeIcon key="t" size={16} strokeWidth={1.75} aria-hidden="true" />],
                                                        ['Background', <Palette key="b" size={16} strokeWidth={1.75} aria-hidden="true" />],
                                                    ] as [string, React.ReactNode][]
                                                ).map(([label, icon]) => (
                                                    <button key={label} type="button" className="rd-btn rd-wide" data-on={libFocus === label} aria-pressed={libFocus === label} onClick={(e) => jumpToLib(e.currentTarget, label)}>
                                                        {icon} {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </BentoControls>
                                    ),
                                },
                                {
                                    id: 'pe-lib-uploads',
                                    colSpan: 2,
                                    rowSpan: 2,
                                    content: (
                                        <BentoControls title="Uploads" description="Pictures, PDFs, code or any file">
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
                                        {lib.map((l) => (
                                            <div key={l.id} className="pe-lib-item">
                                                {l.kind === 'image'
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
                                                      )}
                                                {/* see it large, in a preview window */}
                                                <button type="button" className="pe-lib-peek" onClick={() => setPreview(l)} aria-label={`Preview ${l.kind === 'image' ? l.src.name || 'picture' : l.name}`} title="Preview">
                                                    <Eye size={15} strokeWidth={1.75} aria-hidden="true" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                                        </BentoControls>
                                    ),
                                },
                                {
                                    id: 'pe-lib-photos',
                                    colSpan: 2,
                                    rowSpan: 2,
                                    content: (
                                        <BentoControls title="Photos" description="Free photos to place on the page">
                            <>
                                <p className="rd-hint">Free photos from picsum.photos. Click or drag one onto the page. Needs an internet connection.</p>
                                <div className="rd-lib-grid">
                                    {PHOTOS.map((id) => tile(`ph${id}`, 'photo', { k: 'photo', id }, <img src={`https://picsum.photos/id/${id}/240/180`} alt="" loading="lazy" draggable={false} />, 'rd-lib-tile rd-lib-photo'))}
                                </div>
                            </>
                                        </BentoControls>
                                    ),
                                },
                                {
                                    id: 'pe-lib-elements',
                                    colSpan: 2,
                                    rowSpan: 2,
                                    content: (
                                        <BentoControls title="Elements" description="Shapes and stickers">
                            <>
                                <p className="rd-ied-h">Shapes</p>
                                <div className="rd-lib-grid rd-lib-small">{SHAPES.map((s) => tile(s.kind, s.label, { k: 'shape', kind: s.kind }, <ShapeIcon d={s.d} line={s.line} />))}</div>
                                <p className="rd-ied-h">
                                    <Smile size={14} strokeWidth={1.75} aria-hidden="true" /> Stickers
                                </p>
                                <div className="rd-lib-grid rd-lib-small">{EMOJI.map((ch) => tile(ch, ch, { k: 'emoji', ch }, <span className="rd-emoji">{ch}</span>))}</div>
                            </>
                                        </BentoControls>
                                    ),
                                },
                                {
                                    id: 'pe-lib-text',
                                    colSpan: 2,
                                    rowSpan: 2,
                                    content: (
                                        <BentoControls title="Text" description="Text styles to place on the page">
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
                                        </BentoControls>
                                    ),
                                },
                                {
                                    id: 'pe-lib-background',
                                    colSpan: 2,
                                    rowSpan: 1,
                                    content: (
                                        <BentoControls title="Background" description="Cover the page with a colour">
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
                                        </BentoControls>
                                    ),
                                },
                            ]}
                        />
                    </div>
                    </div>
                    </>
                    )}
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
                    {/* while the page is being drawn: Mediconnect's blade loader on the canvas, not an empty page */}
                    {!failed && !baseReady && (
                        <div className="rd-page-loader" aria-hidden="true" style={{ zIndex: 5 }}>
                            <MediconnectSpinner label="Loading page" />
                        </div>
                    )}
                    <div className="pe-pagecol">
                    {/* The other pages of this window, as in Canva: scroll through them; click one to edit it */}
                    {stackBefore.map((w) => (
                        <StackPage
                            key={w.item.id}
                            item={w.item}
                            pageNo={windowNo(w.index)}
                            pageCount={windowList.length}
                            width={dispW}
                            onOpen={() => void openPage(w.index)}
                            onStep={(dir) => {
                                const t = windowList[windowNo(w.index) - 1 + dir];
                                if (t) void openPage(t.index);
                            }}
                            onOp={onWindowOp ? (op) => void (op === 'blank' ? blankPage().then((b) => onWindowOp('blank', w.index, b)) : onWindowOp(op, w.index)) : undefined}
                            disabled={busy}
                        />
                    ))}
                    <div ref={currentRef} className="pe-current">
                    {/* Page bar, as in Canva: the page's name and its controls */}
                    <div className="pe-pagebar" style={{ width: dispW }} onPointerDown={(e) => e.stopPropagation()}>
                        <span className="pe-pagebar-name">
                            Page {windowPos + 1}
                            {item.hidden ? <span className="pe-pagebar-tag"> · hidden</span> : null}
                        </span>
                        <span className="pe-pagebar-tools">
                            {onGo && (
                                <>
                                    <button type="button" className="pe-pb-btn" onClick={() => void stepPage(-1)} disabled={busy || windowPos <= 0} aria-label="Go to the previous page" title="Previous page">
                                        <ChevronUp size={18} strokeWidth={1.75} aria-hidden="true" />
                                    </button>
                                    <button type="button" className="pe-pb-btn" onClick={() => void stepPage(1)} disabled={busy || windowPos >= windowList.length - 1} aria-label="Go to the next page" title="Next page">
                                        <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
                                    </button>
                                </>
                            )}
                            {onHidePage && (
                                <button type="button" className="pe-pb-btn" data-on={!!item.hidden} onClick={() => onHidePage(ref.current, !item.hidden)} disabled={busy} aria-pressed={!!item.hidden} aria-label={item.hidden ? 'Show page' : 'Hide page'} title={item.hidden ? 'Show page (it is left out of the book and the PDF while hidden)' : 'Hide page (leave it out of the book and the PDF)'}>
                                    {item.hidden ? <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.75} aria-hidden="true" />}
                                </button>
                            )}
                            <button type="button" className="pe-pb-btn" data-on={allLocked} onClick={toggleLockAll} disabled={busy || docMode || overlays.length === 0} aria-pressed={allLocked} aria-label={allLocked ? 'Unlock page' : 'Lock page'} title={allLocked ? 'Unlock everything on this page' : 'Lock everything on this page'}>
                                {allLocked ? <Lock size={18} strokeWidth={1.75} aria-hidden="true" /> : <Unlock size={18} strokeWidth={1.75} aria-hidden="true" />}
                            </button>
                            {onInsertPage && (
                                <button type="button" className="pe-pb-btn" onClick={() => void insertPage('copy')} disabled={busy} aria-label="Duplicate page" title="Duplicate page">
                                    {baking === 'dup' ? <ButtonSpinner /> : <Copy size={18} strokeWidth={1.75} aria-hidden="true" />}
                                </button>
                            )}
                            {onDeletePage && (pageCount ?? 0) > 1 && (
                                <button type="button" className="pe-pb-btn pe-pb-danger" data-on={confirmDel} onClick={() => (confirmDel ? onDeletePage() : setConfirmDel(true))} disabled={busy} aria-label={confirmDel ? 'Tap again to delete the page' : 'Delete page'} title={confirmDel ? 'Tap again to delete' : 'Delete page'}>
                                    <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                                </button>
                            )}
                            {onInsertPage && (
                                <button type="button" className="pe-pb-btn" onClick={() => void insertPage('blank')} disabled={busy} aria-label="Add page" title="Add a blank page after this one">
                                    {baking === 'add' ? <ButtonSpinner /> : <FilePlus2 size={18} strokeWidth={1.75} aria-hidden="true" />}
                                </button>
                            )}
                        </span>
                    </div>
                    <div ref={frameRef} className="rd-ied-frame" data-hidden={item.hidden || undefined} style={{ width: dispW, height: dispH }} onPointerDown={(e) => e.stopPropagation()}>
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
                    {stackAfter.map((w) => (
                        <StackPage
                            key={w.item.id}
                            item={w.item}
                            pageNo={windowNo(w.index)}
                            pageCount={windowList.length}
                            width={dispW}
                            onOpen={() => void openPage(w.index)}
                            onStep={(dir) => {
                                const t = windowList[windowNo(w.index) - 1 + dir];
                                if (t) void openPage(t.index);
                            }}
                            onOp={onWindowOp ? (op) => void (op === 'blank' ? blankPage().then((b) => onWindowOp('blank', w.index, b)) : onWindowOp(op, w.index)) : undefined}
                            disabled={busy}
                        />
                    ))}
                    {/* Add page, as in Canva: a wide button under the pages, with a menu for a blank page or a copy of this one */}
                    {onInsertPage && (
                        <div className="pe-addbar" style={{ width: dispW }} onPointerDown={(e) => e.stopPropagation()}>
                            <button type="button" className="pe-addbar-main" onClick={() => void insertPage('blank')} disabled={busy}>
                                {baking === 'add' ? <ButtonSpinner /> : <span aria-hidden="true">+</span>} Add page
                            </button>
                            <button type="button" className="pe-addbar-more" onClick={() => setAddMenu((v) => !v)} disabled={busy} aria-haspopup="menu" aria-expanded={addMenu} aria-label="More ways to add a page">
                                <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            {addMenu && (
                                <div className="pe-addbar-menu" role="menu" onMouseLeave={() => setAddMenu(false)}>
                                    <button type="button" role="menuitem" onClick={() => { setAddMenu(false); void insertPage('blank'); }}>
                                        <FilePlus2 size={16} strokeWidth={1.75} aria-hidden="true" /> Blank page
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => { setAddMenu(false); void insertPage('copy'); }}>
                                        <Copy size={16} strokeWidth={1.75} aria-hidden="true" /> Duplicate this page
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {/* Preview window for a Library item, in the design of the "Add your own story" window */}
            {preview &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div ref={previewRef} className="pe-preview-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setPreview(null)}>
                        <div className="pe-preview" role="dialog" aria-modal="true" aria-label="Preview">
                            <button type="button" className="pe-preview-close" onClick={() => setPreview(null)} aria-label="Close preview">
                                <X size={22} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <h2 className="pe-preview-title">{preview.kind === 'image' ? preview.src.name || 'Picture' : preview.name}</h2>
                            <div className="pe-preview-body">
                                {preview.kind === 'image' ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={preview.url} alt="" draggable={false} />
                                ) : preview.kind === 'text' ? (
                                    <pre>{preview.text}</pre>
                                ) : (
                                    <p>{preview.label}</p>
                                )}
                            </div>
                            <div className="pe-preview-actions">
                                <button
                                    type="button"
                                    className="pe-preview-add"
                                    onClick={() => {
                                        addFromPayload({ k: 'lib', id: preview.id });
                                        setPreview(null);
                                    }}
                                >
                                    Add to page
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.fullscreenElement ?? document.body
                )}

            {/* Document mode: the rich text editor in place of the page canvas. Keys and pasting stay inside it. */}
            {docMode && docInit && (
                <div ref={docWrapRef} className="rd-ied-doc" style={{ ['--pe-aspect' as string]: String(docAspect) } as React.CSSProperties} onKeyDown={(e) => e.stopPropagation()} onPaste={(e) => e.stopPropagation()}>
                    {message && (
                        <p className="rd-error" role="alert">
                            {message}
                        </p>
                    )}
                    <StoryTextEditor
                        key={docSlot}
                        initial={docInit}
                        draftSlot={docSlot}
                        onChange={(d) => {
                            docLatest.current = d;
                        }}
                        placeholder="Write this page…"
                    />
                    <DocSheets wrap={docWrapRef} aspect={docAspect} hf={docHf} onHf={setDocHf} />
                </div>
            )}
        </div>
    );
}

/* ---------- document mode: the pages as separate sheets ---------- */

const DOC_SHEET_GAP = 24;

interface DocHf {
    header: string;
    footer: string;
    pageNumbers: boolean;
}

/**
 * Lays the document out as separate pages, like Google Docs / Word: a white sheet per page (in the flip book page's
 * proportions) with a grey gap between sheets. Any block (paragraph, heading, list, code block ...) that would cross a
 * sheet's bottom margin is moved to the top of the next sheet, by a style rule only, so the document itself is
 * unchanged. Clicking anywhere in a sheet's writing area puts the cursor in the document.
 *
 * Header and footer, as in Docs / Word: none is shown until you want one. Double-click a page's top margin to write
 * the header, or its bottom margin for the footer (with page numbers if you tick them); Enter or clicking away keeps
 * it, Escape leaves it as it was, and an empty header / footer disappears again. Both repeat on every page.
 * The sheets are drawn inside the editor's page element, so putting the document on the PDF pages cuts along them.
 */
function DocSheets({ wrap, aspect, hf, onHf }: { wrap: React.RefObject<HTMLDivElement>; aspect: number; hf: DocHf; onHf: (hf: DocHf) => void }) {
    const [pageEl, setPageEl] = useState<HTMLElement | null>(null);
    const [pages, setPages] = useState(1);
    const [sheetH, setSheetH] = useState(0);
    const styleRef = useRef<HTMLStyleElement | null>(null);
    /** which margin is being written in, and on which sheet */
    const [editing, setEditing] = useState<{ part: 'header' | 'footer'; sheet: number } | null>(null);
    const [draft, setDraft] = useState<DocHf>(hf);

    // the editor's page element, once the editor has rendered
    useEffect(() => {
        const w = wrap.current;
        if (!w) return undefined;
        const find = () => {
            const el = w.querySelector<HTMLElement>('.sr-page');
            if (el) setPageEl(el);
            return !!el;
        };
        if (find()) return undefined;
        const mo = new MutationObserver(() => {
            if (find()) mo.disconnect();
        });
        mo.observe(w, { childList: true, subtree: true });
        return () => mo.disconnect();
    }, [wrap]);

    useEffect(() => {
        const st = document.createElement('style');
        document.head.appendChild(st);
        styleRef.current = st;
        return () => st.remove();
    }, []);

    useEffect(() => {
        const surface = pageEl?.querySelector<HTMLElement>('.sr-surface');
        if (!pageEl || !surface) return undefined;
        let raf = 0;
        const layout = () => {
            raf = 0;
            const st = styleRef.current;
            if (!st) return;
            const P = pageEl.offsetWidth * aspect;
            const G = DOC_SHEET_GAP;
            const cs = getComputedStyle(pageEl);
            const padT = parseFloat(cs.paddingTop) || 0;
            const padB = parseFloat(cs.paddingBottom) || 0;
            const room = P - padT - padB;
            pageEl.style.setProperty('--pe-room', `${room}px`); // the empty document fills the first page's writing area
            st.textContent = ''; // measure the blocks where they naturally fall
            const box = pageEl.getBoundingClientRect();
            const z = box.height / Math.max(1, pageEl.offsetHeight) || 1; // the editor's zoom
            const kids = Array.from(surface.children) as HTMLElement[];
            const rules: string[] = [];
            let shift = 0;
            let last = padT;
            kids.forEach((k, i) => {
                const r = k.getBoundingClientRect();
                const t = (r.top - box.top) / z + shift;
                const b = (r.bottom - box.top) / z + shift;
                const idx = Math.floor(t / (P + G));
                const local = t - idx * (P + G);
                let push = 0;
                if (local > P - padB) push = (idx + 1) * (P + G) + padT - t; // starts in a bottom margin or a gap
                else if (local < padT && idx > 0) push = idx * (P + G) + padT - t; // starts in a top margin
                else if (b > idx * (P + G) + P - padB && b - t <= room) push = (idx + 1) * (P + G) + padT - t; // crosses the bottom
                if (push > 0.5) {
                    const prevMB = i > 0 ? parseFloat(getComputedStyle(kids[i - 1]).marginBottom) || 0 : 0;
                    const ownMT = parseFloat(getComputedStyle(k).marginTop) || 0;
                    rules.push(`.rd-ied-doc .sr-surface > :nth-child(${i + 1}) { margin-top: ${Math.max(prevMB, ownMT) + push}px !important; }`);
                    shift += push;
                }
                last = Math.max(last, b + (push > 0.5 ? push : 0));
            });
            st.textContent = rules.join('\n');
            const n = Math.max(1, Math.floor((last + padB - 1) / (P + G)) + 1);
            pageEl.style.setProperty('--pe-sheet-h', `${P}px`);
            pageEl.style.setProperty('--pe-gap', `${G}px`);
            pageEl.style.setProperty('--pe-pages', String(n));
            setPages(n);
            setSheetH(P);
        };
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(layout);
        };
        layout();
        const mo = new MutationObserver(schedule);
        mo.observe(surface, { childList: true, subtree: true, characterData: true, attributes: true });
        const ro = new ResizeObserver(schedule);
        ro.observe(surface);
        return () => {
            cancelAnimationFrame(raf);
            mo.disconnect();
            ro.disconnect();
            if (styleRef.current) styleRef.current.textContent = '';
        };
    }, [pageEl, aspect]);

    /** a click in a sheet's writing area (below the text, or on a later page) puts the cursor at the end of the document */
    const focusEnd = (e: React.MouseEvent) => {
        if (e.target !== e.currentTarget) return;
        const surface = pageEl?.querySelector<HTMLElement>('.sr-surface');
        if (!surface) return;
        e.preventDefault();
        surface.focus();
        const r = document.createRange();
        r.selectNodeContents(surface);
        r.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
    };

    const startEdit = (part: 'header' | 'footer', sheet: number) => {
        setDraft(hf);
        setEditing({ part, sheet });
    };
    const finish = (keep: boolean) => {
        if (keep) onHf({ header: draft.header.trim(), footer: draft.footer.trim(), pageNumbers: draft.pageNumbers });
        setEditing(null);
    };
    const keys = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
        }
    };
    // leaving the field (clicking anywhere else) keeps what was written
    const blurOut = (e: React.FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) finish(true);
    };

    if (!pageEl || sheetH <= 0) return null;
    const showFooter = !!hf.footer || hf.pageNumbers;
    return createPortal(
        <div className="pe-sheets">
            {Array.from({ length: pages }, (_, i) => {
                const editHead = editing?.part === 'header' && editing.sheet === i;
                const editFoot = editing?.part === 'footer' && editing.sheet === i;
                return (
                    <div key={i} className="pe-sheet" style={{ top: i * (sheetH + DOC_SHEET_GAP), height: sheetH }} onMouseDown={focusEnd}>
                        <div className="pe-hf pe-hf-head" data-editing={editHead || undefined} title={editHead ? undefined : 'Double-click to write a header'} onDoubleClick={() => startEdit('header', i)}>
                            {editHead ? (
                                <span className="pe-hf-edit" onBlur={blurOut}>
                                    <input autoFocus className="pe-hf-input" value={draft.header} placeholder="Header" aria-label="Header" onChange={(e) => setDraft((d) => ({ ...d, header: e.target.value }))} onKeyDown={keys} />
                                </span>
                            ) : (
                                hf.header && <span>{hf.header}</span>
                            )}
                        </div>
                        <div className="pe-hf pe-hf-foot" data-editing={editFoot || undefined} title={editFoot ? undefined : 'Double-click to write a footer'} onDoubleClick={() => startEdit('footer', i)}>
                            {editFoot ? (
                                <span className="pe-hf-edit" onBlur={blurOut}>
                                    <input autoFocus className="pe-hf-input" value={draft.footer} placeholder="Footer" aria-label="Footer" onChange={(e) => setDraft((d) => ({ ...d, footer: e.target.value }))} onKeyDown={keys} />
                                    <label className="pe-hf-check">
                                        <input type="checkbox" checked={draft.pageNumbers} onChange={(e) => setDraft((d) => ({ ...d, pageNumbers: e.target.checked }))} onKeyDown={keys} /> Page numbers
                                    </label>
                                </span>
                            ) : (
                                showFooter && (
                                    <>
                                        <span>{hf.footer}</span>
                                        {hf.pageNumbers && <span className="pe-pn">Page {i + 1} of {pages}</span>}
                                    </>
                                )
                            )}
                        </div>
                    </div>
                );
            })}
        </div>,
        pageEl
    );
}

/** Mediconnect's blade loader, sized to sit inside a toolbar button while the document is put on the PDF page(s). */
function ButtonSpinner() {
    return (
        <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block', width: 18, height: 18, flex: 'none', transform: 'scale(0.65)', transformOrigin: 'center' }}>
            <MediconnectSpinner label="Adding the document to the PDF" />
        </span>
    );
}

/**
 * Another page of the page editor's window, shown in the stack above / below the page being edited (Canva-style),
 * drawn with everything placed on it. Clicking it opens it for editing.
 */
function StackPage({
    item,
    pageNo,
    pageCount,
    width,
    onOpen,
    onStep,
    onOp,
    disabled,
}: {
    item: PageItem;
    pageNo: number;
    pageCount: number;
    width: number;
    onOpen: () => void;
    onStep: (dir: -1 | 1) => void;
    onOp?: (op: 'hide' | 'show' | 'lock' | 'unlock' | 'duplicate' | 'delete' | 'blank') => void;
    disabled?: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);
    const [confirmDel, setConfirmDel] = useState(false);
    useEffect(() => {
        if (!confirmDel) return undefined;
        const t = setTimeout(() => setConfirmDel(false), 3500);
        return () => clearTimeout(t);
    }, [confirmDel]);
    const locked = item.overlays.length > 0 && item.overlays.every((o) => o.locked);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const side = Math.round(Math.min(1600, width * Math.min(window.devicePixelRatio || 1, 2)));
                let out: HTMLCanvasElement;
                if (item.type === 'image') {
                    out = renderEdit(await getBitmap(item.src), item.edit, side);
                } else {
                    const page = await item.src.pdf.getPage(item.index + 1);
                    const b = page.getViewport({ scale: 1 });
                    const vp = page.getViewport({ scale: side / b.width });
                    out = document.createElement('canvas');
                    out.width = Math.max(1, Math.floor(vp.width));
                    out.height = Math.max(1, Math.floor(vp.height));
                    const c = out.getContext('2d')!;
                    c.fillStyle = '#fff';
                    c.fillRect(0, 0, out.width, out.height);
                    await page.render({ canvasContext: c, canvas: out, viewport: vp } as any).promise;
                    page.cleanup();
                }
                if (item.overlays.length) await drawOverlays(out.getContext('2d')!, out.width, out.height, item.overlays);
                const cv = canvasRef.current;
                if (!alive || !cv) return;
                cv.width = out.width;
                cv.height = out.height;
                cv.getContext('2d')?.drawImage(out, 0, 0);
                setSize({ w: out.width, h: out.height });
            } catch {
                /* the page simply stays empty */
            }
        })();
        return () => {
            alive = false;
        };
    }, [item, width]);

    const h = size ? (width * size.h) / size.w : width * 1.414;
    return (
        <div className="pe-stackpage" style={{ width }} onPointerDown={(e) => e.stopPropagation()}>
            <div className="pe-pagebar" style={{ width }}>
                <span className="pe-pagebar-name">
                    Page {pageNo}
                    {item.hidden ? <span className="pe-pagebar-tag"> · hidden</span> : null}
                </span>
                {/* the same controls as the page being edited, acting on this page */}
                <span className="pe-pagebar-tools">
                    <button type="button" className="pe-pb-btn" onClick={() => onStep(-1)} disabled={disabled || pageNo <= 1} aria-label="Go to the previous page" title="Previous page">
                        <ChevronUp size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className="pe-pb-btn" onClick={() => onStep(1)} disabled={disabled || pageNo >= pageCount} aria-label="Go to the next page" title="Next page">
                        <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    {onOp && (
                        <>
                            <button type="button" className="pe-pb-btn" data-on={!!item.hidden} onClick={() => onOp(item.hidden ? 'show' : 'hide')} disabled={disabled} aria-pressed={!!item.hidden} aria-label={item.hidden ? 'Show page' : 'Hide page'} title={item.hidden ? 'Show page' : 'Hide page (leave it out of the book and the PDF)'}>
                                {item.hidden ? <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.75} aria-hidden="true" />}
                            </button>
                            <button type="button" className="pe-pb-btn" data-on={locked} onClick={() => onOp(locked ? 'unlock' : 'lock')} disabled={disabled || item.overlays.length === 0} aria-pressed={locked} aria-label={locked ? 'Unlock page' : 'Lock page'} title={locked ? 'Unlock everything on this page' : 'Lock everything on this page'}>
                                {locked ? <Lock size={18} strokeWidth={1.75} aria-hidden="true" /> : <Unlock size={18} strokeWidth={1.75} aria-hidden="true" />}
                            </button>
                            <button type="button" className="pe-pb-btn" onClick={() => onOp('duplicate')} disabled={disabled} aria-label="Duplicate page" title="Duplicate page">
                                <Copy size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            {pageCount > 1 && (
                                <button type="button" className="pe-pb-btn pe-pb-danger" data-on={confirmDel} onClick={() => (confirmDel ? onOp('delete') : setConfirmDel(true))} disabled={disabled} aria-label={confirmDel ? 'Tap again to delete the page' : 'Delete page'} title={confirmDel ? 'Tap again to delete' : 'Delete page'}>
                                    <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                                </button>
                            )}
                            <button type="button" className="pe-pb-btn" onClick={() => onOp('blank')} disabled={disabled} aria-label="Add page" title="Add a blank page after this one">
                                <FilePlus2 size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                        </>
                    )}
                </span>
            </div>
            <button type="button" className="pe-stackpage-btn" style={{ width, height: h }} onClick={onOpen} disabled={disabled} aria-label={`Edit page ${pageNo}`} title="Click to edit this page" data-hidden={item.hidden || undefined}>
                <canvas ref={canvasRef} style={{ width, height: h, display: 'block' }} />
                {!size && (
                    <span className="rd-page-loader" aria-hidden="true">
                        <MediconnectSpinner label="Loading page" />
                    </span>
                )}
            </button>
        </div>
    );
}

/** One editor card in the Magic Bento: its controls (scrolling inside the card when long), then a title and a
 *  description in the bento's own card style. */
function BentoControls({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <>
            <div className="pe-bento-controls">{children}</div>
            <div className="mt-auto flex flex-col gap-1">
                <h3 className="m-0 text-[15px] leading-5 font-semibold tracking-[-0.01em] text-[color:var(--mb-ink)]">{title}</h3>
                <p className="m-0 line-clamp-2 text-[13px] leading-[1.45] text-[color:var(--mb-muted)]">{description}</p>
            </div>
        </>
    );
}
