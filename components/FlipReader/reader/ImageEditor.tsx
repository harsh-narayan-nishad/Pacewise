'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlipHorizontal2, FlipVertical2, Redo2, RotateCcw, RotateCw, Undo2 } from 'lucide-react';

import { getBitmap, renderEdit } from '@/lib/flipreader/imageops';
import { defaultEdit, isDefaultEdit } from '@/lib/flipreader/pages';
import type { Crop, FilterName, ImageEdit, ImageItem } from '@/lib/flipreader/types';

type Tab = 'crop' | 'adjust' | 'filters';
type Handle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.06; // smallest crop, as a fraction of the picture

const ASPECTS: { id: string; label: string; ratio: number | 'orig' | null }[] = [
    { id: 'free', label: 'Free', ratio: null },
    { id: 'orig', label: 'Original', ratio: 'orig' },
    { id: '1:1', label: '1:1', ratio: 1 },
    { id: '4:3', label: '4:3', ratio: 4 / 3 },
    { id: '3:4', label: '3:4', ratio: 3 / 4 },
    { id: '16:9', label: '16:9', ratio: 16 / 9 },
    { id: '9:16', label: '9:16', ratio: 9 / 16 },
    { id: 'A4', label: 'A4', ratio: 1 / 1.414 },
];

const FILTERS: { id: FilterName; label: string }[] = [
    { id: 'none', label: 'Original' },
    { id: 'mono', label: 'Mono' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'vivid', label: 'Vivid' },
    { id: 'fade', label: 'Fade' },
    { id: 'invert', label: 'Invert' },
];

const ADJUST: { key: 'brightness' | 'contrast' | 'saturation' | 'warmth' | 'sharpen'; label: string; min: number; max: number }[] = [
    { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
    { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
    { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
    { key: 'warmth', label: 'Warmth', min: -100, max: 100 },
    { key: 'sharpen', label: 'Sharpness', min: 0, max: 100 },
];

/* ---- crop maths ---- */

const rotateCrop = (c: Crop, dir: 1 | -1): Crop =>
    dir === 1 ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w };

/** Largest centred crop of a given shape (ratio = width / height in pixels) inside a frame of shape `fa`. */
function fitCrop(ratio: number, fa: number): Crop {
    const w = ratio > fa ? 1 : ratio / fa;
    const h = ratio > fa ? fa / ratio : 1;
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

function resizeCrop(handle: Handle, r0: Crop, dx: number, dy: number, ratio: number | null, fa: number): Crop {
    if (handle === 'move') return { ...r0, x: clamp(r0.x + dx, 0, 1 - r0.w), y: clamp(r0.y + dy, 0, 1 - r0.h) };

    if (ratio && handle.length === 2) {
        // a corner with a locked shape: the opposite corner stays put
        const west = handle.includes('w');
        const north = handle.includes('n');
        const ax = west ? r0.x + r0.w : r0.x;
        const ay = north ? r0.y + r0.h : r0.y;
        const px = (west ? r0.x : r0.x + r0.w) + dx;
        const py = (north ? r0.y : r0.y + r0.h) + dy;
        const sx = west ? -1 : 1;
        const sy = north ? -1 : 1;
        let fw = Math.max(MIN, (px - ax) * sx, ((py - ay) * sy * ratio) / fa);
        let fh = (fw * fa) / ratio;
        const roomX = sx === 1 ? 1 - ax : ax;
        const roomY = sy === 1 ? 1 - ay : ay;
        if (fw > roomX) {
            fw = roomX;
            fh = (fw * fa) / ratio;
        }
        if (fh > roomY) {
            fh = roomY;
            fw = (fh * ratio) / fa;
        }
        return { x: sx === 1 ? ax : ax - fw, y: sy === 1 ? ay : ay - fh, w: fw, h: fh };
    }

    let x1 = r0.x;
    let y1 = r0.y;
    let x2 = r0.x + r0.w;
    let y2 = r0.y + r0.h;
    if (handle.includes('w')) x1 = clamp(x1 + dx, 0, x2 - MIN);
    if (handle.includes('e')) x2 = clamp(x2 + dx, x1 + MIN, 1);
    if (handle.includes('n')) y1 = clamp(y1 + dy, 0, y2 - MIN);
    if (handle.includes('s')) y2 = clamp(y2 + dy, y1 + MIN, 1);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/* ---- small pieces ---- */

function Slider({
    label,
    value,
    min,
    max,
    onStart,
    onChange,
    onEnd,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onStart: () => void;
    onChange: (v: number) => void;
    onEnd: () => void;
}) {
    return (
        <label className="rd-slider">
            <span>{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={value}
                onPointerDown={onStart}
                onKeyDown={onStart}
                onPointerUp={onEnd}
                onKeyUp={onEnd}
                onBlur={onEnd}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label={label}
            />
            <output>{value}</output>
        </label>
    );
}

function FilterThumb({ bitmap, edit, filter }: { bitmap: ImageBitmap; edit: ImageEdit; filter: FilterName }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const out = renderEdit(bitmap, { ...edit, filter }, 96);
        const c = ref.current;
        if (!c) return;
        c.width = out.width;
        c.height = out.height;
        c.getContext('2d')?.drawImage(out, 0, 0);
    }, [bitmap, edit.rotate, edit.flipH, edit.flipV, edit.straighten, edit.crop, filter]); // eslint-disable-line react-hooks/exhaustive-deps
    return <canvas ref={ref} />;
}

/* ---- the editor ---- */

export function ImageEditor({ item, onApply, onCancel }: { item: ImageItem; onApply: (edit: ImageEdit) => void; onCancel: () => void }) {
    const [edit, setEdit] = useState<ImageEdit>(item.edit);
    const editRef = useRef<ImageEdit>(item.edit);
    const past = useRef<ImageEdit[]>([]);
    const future = useRef<ImageEdit[]>([]);
    const gesture = useRef(false);

    const [tab, setTab] = useState<Tab>('crop');
    const [lock, setLock] = useState<number | null>(null);
    const [aspectId, setAspectId] = useState('free');
    const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
    const [failed, setFailed] = useState(false);

    const stageRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLCanvasElement>(null);
    const [stage, setStage] = useState({ w: 0, h: 0 });
    const [frame, setFrame] = useState({ w: 1, h: 1 }); // pixel size of the preview picture

    useEffect(() => {
        let alive = true;
        getBitmap(item.src)
            .then((b) => alive && setBitmap(b))
            .catch(() => alive && setFailed(true));
        return () => {
            alive = false;
        };
    }, [item.src]);

    useEffect(() => {
        const el = stageRef.current;
        if (!el) return undefined;
        const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    /* ---- editing with undo / redo ---- */
    const set = useCallback((next: ImageEdit, record = true) => {
        if (record) {
            past.current.push(editRef.current);
            if (past.current.length > 60) past.current.shift();
            future.current = [];
        }
        editRef.current = next;
        setEdit(next);
    }, []);

    /** Sliders and drags are one undo step: remember the start once, then change freely. */
    const startGesture = useCallback(() => {
        if (gesture.current) return;
        gesture.current = true;
        past.current.push(editRef.current);
        future.current = [];
    }, []);
    const endGesture = useCallback(() => {
        gesture.current = false;
    }, []);

    const undo = useCallback(() => {
        const prev = past.current.pop();
        if (!prev) return;
        future.current.push(editRef.current);
        editRef.current = prev;
        setEdit(prev);
    }, []);
    const redo = useCallback(() => {
        const next = future.current.pop();
        if (!next) return;
        past.current.push(editRef.current);
        editRef.current = next;
        setEdit(next);
    }, []);

    /* ---- preview ---- */
    useEffect(() => {
        if (!bitmap) return undefined;
        const id = requestAnimationFrame(() => {
            // while cropping, show the whole picture so the crop box has something to sit on
            const e = tab === 'crop' ? { ...edit, crop: null } : edit;
            const out = renderEdit(bitmap, e, 1100);
            const c = previewRef.current;
            if (!c) return;
            c.width = out.width;
            c.height = out.height;
            c.getContext('2d')?.drawImage(out, 0, 0);
            setFrame({ w: out.width, h: out.height });
        });
        return () => cancelAnimationFrame(id);
    }, [bitmap, edit, tab]);

    const fit = Math.min(stage.w / frame.w, stage.h / frame.h) || 1;
    const dispW = Math.max(1, frame.w * fit);
    const dispH = Math.max(1, frame.h * fit);
    const fa = frame.w / frame.h;

    /* ---- transform buttons ---- */
    const turn = (dir: 1 | -1) => {
        const e = editRef.current;
        set({ ...e, rotate: ((e.rotate + (dir === 1 ? 90 : 270)) % 360) as ImageEdit['rotate'], crop: e.crop ? rotateCrop(e.crop, dir) : null });
        setLock(null);
        setAspectId('free');
    };
    const flip = (axis: 'h' | 'v') => {
        const e = editRef.current;
        const sideways = e.rotate % 180 !== 0;
        // the flip is stored on the source picture, so a screen-horizontal flip of a sideways picture is a vertical one
        const onH = axis === 'h' ? !sideways : sideways;
        const c = e.crop;
        set({
            ...e,
            flipH: onH ? !e.flipH : e.flipH,
            flipV: onH ? e.flipV : !e.flipV,
            crop: c ? (axis === 'h' ? { ...c, x: 1 - c.x - c.w } : { ...c, y: 1 - c.y - c.h }) : null,
        });
    };

    const chooseAspect = (id: string) => {
        const a = ASPECTS.find((x) => x.id === id)!;
        setAspectId(id);
        const ratio = a.ratio === 'orig' ? fa : a.ratio;
        setLock(ratio);
        if (ratio) set({ ...editRef.current, crop: fitCrop(ratio, fa) });
    };

    /* ---- crop box dragging ---- */
    const drag = useRef<{ handle: Handle; sx: number; sy: number; r0: Crop } | null>(null);
    const crop = edit.crop ?? FULL;

    const down = (handle: Handle) => (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        startGesture();
        drag.current = { handle, sx: e.clientX, sy: e.clientY, r0: editRef.current.crop ?? FULL };
    };
    const move = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d) return;
        const next = resizeCrop(d.handle, d.r0, (e.clientX - d.sx) / dispW, (e.clientY - d.sy) / dispH, lock, fa);
        set({ ...editRef.current, crop: next }, false);
    };
    const up = () => {
        drag.current = null;
        endGesture();
    };

    /* ---- keyboard ---- */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(t && t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text')) {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel, undo, redo]);

    const handles: Handle[] = lock ? ['nw', 'ne', 'se', 'sw'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const changed = !isDefaultEdit(edit);

    return (
        <div className="rd-ied" role="dialog" aria-label="Edit image">
            <div className="rd-ied-top">
                <button type="button" className="rd-btn rd-wide" onClick={onCancel}>
                    Cancel
                </button>
                <div className="rd-ied-mid">
                    <button type="button" className="rd-btn" onClick={undo} disabled={past.current.length === 0} aria-label="Undo" title="Undo (Ctrl+Z)">
                        <Undo2 size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className="rd-btn" onClick={redo} disabled={future.current.length === 0} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                        <Redo2 size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button type="button" className="rd-btn rd-wide" onClick={() => set(defaultEdit())} disabled={!changed} title="Back to the original picture">
                        Reset
                    </button>
                </div>
                <button type="button" className="rd-btn rd-wide rd-accent" data-on="true" onClick={() => onApply(editRef.current)}>
                    Apply
                </button>
            </div>

            <div ref={stageRef} className="rd-ied-stage">
                {failed && <p className="rd-error">This picture could not be opened.</p>}
                <div className="rd-ied-frame" style={{ width: dispW, height: dispH }}>
                    <canvas ref={previewRef} style={{ width: dispW, height: dispH }} />
                    {tab === 'crop' && bitmap && (
                        <div className="rd-crop-layer">
                            <div
                                className="rd-crop"
                                style={{ left: crop.x * dispW, top: crop.y * dispH, width: crop.w * dispW, height: crop.h * dispH }}
                                onPointerDown={down('move')}
                                onPointerMove={move}
                                onPointerUp={up}
                                onPointerCancel={up}
                                role="group"
                                aria-label="Crop area. Drag to move, drag the handles to resize."
                            >
                                {handles.map((h) => (
                                    <div key={h} className="rd-crop-h" data-h={h} onPointerDown={down(h)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="rd-ied-panel">
                <div className="rd-tabs" role="tablist">
                    {(['crop', 'adjust', 'filters'] as Tab[]).map((t) => (
                        <button key={t} type="button" role="tab" aria-selected={tab === t} data-on={tab === t} className="rd-btn rd-wide" onClick={() => setTab(t)}>
                            {t === 'crop' ? 'Crop & rotate' : t === 'adjust' ? 'Adjust' : 'Filters'}
                        </button>
                    ))}
                </div>

                {tab === 'crop' && (
                    <div className="rd-ied-controls">
                        <div className="rd-chips" role="radiogroup" aria-label="Crop shape">
                            {ASPECTS.map((a) => (
                                <button key={a.id} type="button" role="radio" aria-checked={aspectId === a.id} data-on={aspectId === a.id} className="rd-btn rd-wide" onClick={() => chooseAspect(a.id)}>
                                    {a.label}
                                </button>
                            ))}
                            <button type="button" className="rd-btn rd-wide" onClick={() => { set({ ...editRef.current, crop: null }); setLock(null); setAspectId('free'); }} disabled={!edit.crop}>
                                Clear crop
                            </button>
                        </div>
                        <div className="rd-chips">
                            <button type="button" className="rd-btn rd-wide" onClick={() => turn(-1)} aria-label="Rotate left 90 degrees">
                                <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /> Rotate left
                            </button>
                            <button type="button" className="rd-btn rd-wide" onClick={() => turn(1)} aria-label="Rotate right 90 degrees">
                                <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" /> Rotate right
                            </button>
                            <button type="button" className="rd-btn rd-wide" onClick={() => flip('h')} aria-label="Flip horizontally">
                                <FlipHorizontal2 size={16} strokeWidth={1.75} aria-hidden="true" /> Flip
                            </button>
                            <button type="button" className="rd-btn rd-wide" onClick={() => flip('v')} aria-label="Flip vertically">
                                <FlipVertical2 size={16} strokeWidth={1.75} aria-hidden="true" /> Flip
                            </button>
                        </div>
                        <Slider
                            label="Straighten"
                            value={edit.straighten}
                            min={-45}
                            max={45}
                            onStart={startGesture}
                            onEnd={endGesture}
                            onChange={(v) => set({ ...editRef.current, straighten: v }, false)}
                        />
                    </div>
                )}

                {tab === 'adjust' && (
                    <div className="rd-ied-controls">
                        {ADJUST.map((a) => (
                            <Slider
                                key={a.key}
                                label={a.label}
                                value={edit[a.key]}
                                min={a.min}
                                max={a.max}
                                onStart={startGesture}
                                onEnd={endGesture}
                                onChange={(v) => set({ ...editRef.current, [a.key]: v }, false)}
                            />
                        ))}
                    </div>
                )}

                {tab === 'filters' && (
                    <div className="rd-ied-controls rd-filters">
                        {FILTERS.map((f) => (
                            <button key={f.id} type="button" className="rd-filter" data-on={edit.filter === f.id} aria-pressed={edit.filter === f.id} onClick={() => set({ ...editRef.current, filter: f.id })}>
                                {bitmap ? <FilterThumb bitmap={bitmap} edit={edit} filter={f.id} /> : <canvas />}
                                <span>{f.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
