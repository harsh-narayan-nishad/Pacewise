'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

import LiquidGlass from '@/components/FlipReader/ui/LiquidGlass';
import { ACCEPT_PAGES } from '@/lib/flipreader/loaders';
import { drawThumb } from '@/lib/flipreader/thumbs';
import type { PageItem, PagesDoc } from '@/lib/flipreader/types';

export type InsertMode = 'before' | 'after' | 'end';

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
    onDelete: () => void;
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
    const fileRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const item = p.doc.items[p.selected] as PageItem | undefined;
    const count = p.doc.items.length;

    useEffect(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, [p.selected, count]);

    return (
        <div className="rd-tray" role="dialog" aria-label="Pages">
            <LiquidGlass width="100%" height="auto" radius={28} blur={6}>
                <div className="rd-tray-body">
                    <div className="rd-tray-head">
                        <h2>
                            Pages <span>{count}</span>
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

                    <div ref={listRef} className="rd-strip" role="listbox" aria-label="Pages of the book">
                        {count === 0 && <p className="rd-empty">No pages left. Add images or PDFs below.</p>}
                        {p.doc.items.map((it, i) => (
                            <button
                                key={it.id}
                                type="button"
                                role="option"
                                aria-selected={i === p.selected}
                                className="rd-thumb"
                                onClick={() => p.onSelect(i)}
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
                        <button type="button" className="rd-btn rd-wide rd-danger" onClick={p.onDelete} disabled={!item} aria-label="Delete this page">
                            Delete
                        </button>
                    </div>

                    <div className="rd-tray-add">
                        <span className="rd-label">Add images or PDFs</span>
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
        </div>
    );
}
