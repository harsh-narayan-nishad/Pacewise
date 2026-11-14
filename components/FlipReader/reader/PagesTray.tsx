'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

import LiquidGlass from '@/components/FlipReader/ui/LiquidGlass';
import { ACCEPT_PAGES } from '@/lib/flipreader/loaders';
import { drawThumb } from '@/lib/flipreader/thumbs';
import type { PageItem, PagesDoc } from '@/lib/flipreader/types';
import { PagePreview } from './PagePreview';

export type InsertMode = 'before' | 'after' | 'end';

const PAGE_MIME = 'application/x-pacewise-page';

interface Props {
    doc: PagesDoc;
    selected: number;
    onSelect: (i: number) => void;
    insertMode: InsertMode;
    onInsertMode: (m: InsertMode) => void;
    onAddFiles: (files: File[]) => void;
    onEdit: () => void;
    onAnnotate: () => void;
    onConvert: () => void;
    onDuplicate: () => void;
    onMove: (dir: -1 | 1) => void;
    /** drag a page to any place in the strip: the page at `from` goes to position `to` */
    onReorder?: (from: number, to: number) => void;
    onDelete: () => void;
    /** delete several pages at once (pages picked together, or dragged out of the strip) */
    onDeleteMany?: (indices: number[]) => void;
    /** a code / text page edited in the preview: drawn again with this text */
    onSaveCode?: (index: number, text: string) => void;
    onUndo: () => void;
    canUndo: boolean;
    onExport: () => void;
    exporting: { done: number; total: number } | null;
    onClose: () => void;
}

/** A small picture of a page, drawn only once it scrolls into view. */
function Thumb({ item }: { item: PageItem }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const [seen, setSeen] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setSeen(true);
                    io.disconnect();
                }
            },
            { rootMargin: '240px' }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const edit = item.type === 'image' ? item.edit : null;
    useEffect(() => {
        if (!seen || !ref.current) return undefined;
        let cancelled = false;
        void drawThumb(item, ref.current, 110, () => cancelled);
        return () => {
            cancelled = true;
        };
    }, [seen, item.id, item.src, edit]); // eslint-disable-line react-hooks/exhaustive-deps

    return <canvas ref={ref} className="rd-thumb-canvas" aria-hidden="true" />;
}

/** The pages of the book as a strip: choose a page, then add, edit, move, duplicate or delete it. */
export function PagesTray(p: Props) {
    /** dragging a page thumbnail to a new place */
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [dropAt, setDropAt] = useState<{ i: number; side: 'before' | 'after' } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const trayRef = useRef<HTMLDivElement>(null);
    const item = p.doc.items[p.selected] as PageItem | undefined;
    const count = p.doc.items.length;

    /** pages picked together: drag a box over them, or Cmd / Ctrl / Shift + click (by page id) */
    const [picked, setPicked] = useState<string[]>([]);
    const pickedIdx = p.doc.items.map((it, i) => (picked.includes(it.id) ? i : -1)).filter((i) => i >= 0);
    const anchor = useRef<number | null>(null);
    const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
    const boxBase = useRef<string[]>([]);
    const startBox = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest('.rd-thumb')) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        boxBase.current = e.shiftKey || e.metaKey || e.ctrlKey ? picked : [];
        setBox({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
        if (!boxBase.current.length) setPicked([]);
    };
    const moveBox = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!box) return;
        const b = { ...box, x1: e.clientX, y1: e.clientY };
        setBox(b);
        const l = Math.min(b.x0, b.x1);
        const r = Math.max(b.x0, b.x1);
        const t = Math.min(b.y0, b.y1);
        const btm = Math.max(b.y0, b.y1);
        const hit: string[] = [];
        listRef.current?.querySelectorAll<HTMLElement>('.rd-thumb').forEach((el, i) => {
            const rc = el.getBoundingClientRect();
            if (rc.right > l && rc.left < r && rc.bottom > t && rc.top < btm && p.doc.items[i]) hit.push(p.doc.items[i].id);
        });
        setPicked(Array.from(new Set([...boxBase.current, ...hit])));
        // near the strip's ends, it scrolls on so pages further along can be reached
        const s = listRef.current;
        if (s) {
            const sr = s.getBoundingClientRect();
            if (e.clientX > sr.right - 24) s.scrollLeft += 12;
            else if (e.clientX < sr.left + 24) s.scrollLeft -= 12;
        }
    };
    const endBox = () => setBox(null);

    /** the pages a drag carries: all picked pages when the dragged one is among them, else just that one */
    const dragSet = (from: number) => (pickedIdx.includes(from) && pickedIdx.length > 1 ? pickedIdx : [from]);
    /** a dragged page is over the page outside the strip: let go there to delete it */
    const [outside, setOutside] = useState(false);
    useEffect(() => {
        if (dragFrom === null) return undefined;
        const isOut = (e: DragEvent) => {
            const r = trayRef.current?.getBoundingClientRect();
            return !!r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
        };
        const onOver = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes(PAGE_MIME)) return;
            const out = isOut(e);
            setOutside(out);
            if (out) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        };
        const onDropOut = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes(PAGE_MIME) || !isOut(e)) return;
            e.preventDefault();
            e.stopPropagation();
            const gone = dragSet(dragFrom);
            setDragFrom(null);
            setDropAt(null);
            setOutside(false);
            setPicked([]);
            if (gone.length > 1 && p.onDeleteMany) p.onDeleteMany(gone);
            else if (gone.length === 1) {
                if (p.onDeleteMany) p.onDeleteMany(gone);
                else if (gone[0] === p.selected) p.onDelete();
            }
        };
        window.addEventListener('dragover', onOver, true);
        window.addEventListener('drop', onDropOut, true);
        return () => {
            window.removeEventListener('dragover', onOver, true);
            window.removeEventListener('drop', onDropOut, true);
            setOutside(false);
        };
    }, [dragFrom, picked, p.doc.items]); // eslint-disable-line react-hooks/exhaustive-deps
    const deleteCount = pickedIdx.length > 1 ? pickedIdx.length : 1;

    /** Space: the selected page (or all picked pages) shown large, a code / text page editable there */
    const [previewIds, setPreviewIds] = useState<string[] | null>(null);
    /** how the last page was pressed: on a tablet / phone (no Space key) a tap on a page opens its preview */
    const lastPointer = useRef<string>('mouse');
    const spaceRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
    spaceRef.current = (e) => {
        if (e.key !== ' ' || e.repeat || previewIds || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target as HTMLElement | null;
        if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
        if (document.querySelector('.rd-ied, .pe-preview-backdrop')) return; // the page editor or another preview is open
        const ids = pickedIdx.length > 1 ? pickedIdx.map((i) => p.doc.items[i].id) : item ? [item.id] : [];
        if (!ids.length) return;
        e.preventDefault();
        e.stopImmediatePropagation(); // not the book's own Space (turning the page)
        setPreviewIds(ids);
    };
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => spaceRef.current(e);
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);
    const previewItems = previewIds ? (previewIds.map((id) => p.doc.items.find((x) => x.id === id)).filter(Boolean) as PageItem[]) : [];


    useEffect(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, [p.selected, count]);

    return (
        <div ref={trayRef} className="rd-tray" role="dialog" aria-label="Pages" data-dropout={outside || undefined}>
            <LiquidGlass width="100%" height="auto" radius={28} blur={6}>
                <div className="rd-tray-body">
                    <div className="rd-tray-head">
                        <h2>
                            Pages <span>{count}</span>
                            {dragFrom !== null && <span className="rd-tray-hint">{outside ? `Let go to delete ${dragSet(dragFrom).length > 1 ? `${dragSet(dragFrom).length} pages` : 'the page'}` : 'Drop outside to delete'}</span>}
                            {dragFrom === null && pickedIdx.length > 1 && <span className="rd-tray-hint">{pickedIdx.length} selected</span>}
                        </h2>
                        <div className="rd-tray-actions">
                            <button type="button" className="rd-btn rd-wide" onClick={p.onUndo} disabled={!p.canUndo} aria-label="Undo the last change to the pages">
                                Undo
                            </button>
                            <button type="button" className="rd-btn rd-wide rd-accent" onClick={p.onExport} disabled={!!p.exporting || count === 0} aria-label="Download all pages as one PDF">
                                {p.exporting ? `Building ${p.exporting.done}/${p.exporting.total}` : 'Download PDF'}
                            </button>
                            <button type="button" className="rd-btn" onClick={p.onClose} aria-label="Close pages" title="Close">
                                <X size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    <div ref={listRef} className="rd-strip" role="listbox" aria-label="Pages of the book" aria-multiselectable="true" onPointerDown={startBox} onPointerMove={moveBox} onPointerUp={endBox} onPointerCancel={endBox}>
                        {count === 0 && <p className="rd-empty">No pages left. Add images or PDFs below.</p>}
                        {p.doc.items.map((it, i) => (
                            <button
                                key={it.id}
                                type="button"
                                role="option"
                                aria-selected={i === p.selected}
                                className="rd-thumb"
                                data-drop={dropAt && dropAt.i === i ? dropAt.side : undefined}
                                data-dragging={(dragFrom !== null && dragSet(dragFrom).includes(i)) || undefined}
                                data-picked={(pickedIdx.length > 1 && pickedIdx.includes(i)) || undefined}
                                draggable={!!p.onReorder}
                                onDragStart={(e) => {
                                    setDragFrom(i);
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData(PAGE_MIME, String(i));
                                }}
                                onDragOver={(e) => {
                                    if (dragFrom === null) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const r = e.currentTarget.getBoundingClientRect();
                                    const side = e.clientX < r.left + r.width / 2 ? 'before' : 'after';
                                    if (!dropAt || dropAt.i !== i || dropAt.side !== side) setDropAt({ i, side });
                                }}
                                onDrop={(e) => {
                                    if (dragFrom === null) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const r = e.currentTarget.getBoundingClientRect();
                                    let to = e.clientX < r.left + r.width / 2 ? i : i + 1;
                                    if (dragFrom < to) to -= 1; // the dragged page leaves its old place first
                                    if (to !== dragFrom) p.onReorder?.(dragFrom, to);
                                    setDragFrom(null);
                                    setDropAt(null);
                                }}
                                onDragEnd={() => {
                                    setDragFrom(null);
                                    setDropAt(null);
                                }}
                                onPointerDown={(e) => {
                                    lastPointer.current = e.pointerType;
                                }}
                                onClick={(e) => {
                                    if (e.metaKey || e.ctrlKey) {
                                        // Cmd / Ctrl + click: add or take out this page (the one you clicked stays current)
                                        const base = picked.length ? picked : item ? [item.id] : [];
                                        setPicked(base.includes(it.id) ? base.filter((x) => x !== it.id) : [...base, it.id]);
                                    } else if (e.shiftKey) {
                                        // Shift + click: every page from the last one clicked to this one
                                        const a = anchor.current ?? p.selected;
                                        setPicked(p.doc.items.slice(Math.min(a, i), Math.max(a, i) + 1).map((x) => x.id));
                                    } else {
                                        setPicked([]);
                                        anchor.current = i;
                                        if (lastPointer.current === 'touch' || lastPointer.current === 'pen') setPreviewIds([it.id]);
                                    }
                                    p.onSelect(i);
                                }}
                                aria-label={`Page ${i + 1}, ${it.type === 'image' ? 'image' : 'PDF page'}`}
                            >
                                <Thumb item={it} />
                                <span className="rd-thumb-no">{i + 1}</span>
                                {it.type === 'image' && <span className="rd-thumb-tag">img</span>}
                                {it.overlays.length > 0 && <span className="rd-thumb-ovl" title="Pictures or text added on this page">+{it.overlays.length}</span>}
                            </button>
                        ))}
                    </div>

                    <div className="rd-tray-tools" role="toolbar" aria-label="Selected page">
                        <button type="button" className="rd-btn rd-wide rd-accent" onClick={p.onAnnotate} disabled={!item} title="Place pictures and text on this page, and move, resize or turn them">
                            Add to page
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={p.onEdit} disabled={item?.type !== 'image'} title="Crop, rotate, adjust colours">
                            Edit image
                        </button>
                        {item?.type === 'pdf' && (
                            <button type="button" className="rd-btn rd-wide" onClick={p.onConvert} title="Turn this PDF page into a picture you can crop and adjust (its text is no longer searchable)">
                                Make editable
                            </button>
                        )}
                        <button type="button" className="rd-btn rd-wide" onClick={() => p.onMove(-1)} disabled={!item || p.selected === 0} aria-label="Move page earlier">
                            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Move
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={() => p.onMove(1)} disabled={!item || p.selected >= count - 1} aria-label="Move page later">
                            Move <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button type="button" className="rd-btn rd-wide" onClick={p.onDuplicate} disabled={!item}>
                            Duplicate
                        </button>
                        <button
                            type="button"
                            className="rd-btn rd-wide rd-danger"
                            onClick={() => {
                                if (pickedIdx.length > 1 && p.onDeleteMany) {
                                    p.onDeleteMany(pickedIdx);
                                    setPicked([]);
                                } else p.onDelete();
                            }}
                            disabled={!item}
                            aria-label={deleteCount > 1 ? `Delete ${deleteCount} pages` : 'Delete this page'}
                        >
                            {deleteCount > 1 ? `Delete ${deleteCount}` : 'Delete'}
                        </button>
                    </div>

                    <div className="rd-tray-add">
                        <span className="rd-label">Add images, PDFs or code</span>
                        <div className="rd-seg" role="radiogroup" aria-label="Where to add">
                            {(['before', 'after', 'end'] as const).map((m) => (
                                <button key={m} type="button" role="radio" aria-checked={p.insertMode === m} data-on={p.insertMode === m} className="rd-btn rd-wide" onClick={() => p.onInsertMode(m)} disabled={m !== 'end' && count === 0}>
                                    {m === 'before' ? 'Before page' : m === 'after' ? 'After page' : 'At the end'}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="rd-btn rd-wide rd-accent" onClick={() => fileRef.current?.click()}>
                            Choose files…
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            multiple
                            accept={ACCEPT_PAGES}
                            hidden
                            onChange={(e) => {
                                const files = Array.from(e.target.files ?? []);
                                e.target.value = '';
                                if (files.length) p.onAddFiles(files);
                            }}
                        />
                    </div>
                </div>
            </LiquidGlass>
            {previewIds && previewItems.length > 0 && (
                <PagePreview
                    items={previewItems}
                    start={Math.max(0, previewItems.findIndex((x) => x.id === item?.id))}
                    pageNo={(x) => p.doc.items.findIndex((y) => y.id === x.id) + 1}
                    onClose={() => setPreviewIds(null)}
                    onSaveCode={(x, text) => {
                        const i = p.doc.items.findIndex((y) => y.id === x.id);
                        if (i >= 0) p.onSaveCode?.(i, text);
                    }}
                />
            )}
            {box && (
                <div
                    className="rd-tray-box"
                    aria-hidden="true"
                    style={{ left: Math.min(box.x0, box.x1) - (trayRef.current?.getBoundingClientRect().left ?? 0), top: Math.min(box.y0, box.y1) - (trayRef.current?.getBoundingClientRect().top ?? 0), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) }}
                />
            )}
        </div>
    );
}
