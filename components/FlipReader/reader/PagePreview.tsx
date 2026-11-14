'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { drawThumb } from '@/lib/flipreader/thumbs';
import type { PageItem } from '@/lib/flipreader/types';
import { MediconnectSpinner } from '@/components/ui/loaders/MediconnectSpinner';
import { CodeEdit } from './PageEditor';

/** the text of a page made from a code / text file (null for other pages) */
export const pageCode = (it: PageItem | undefined) => (it && it.type === 'image' && it.src.code ? it.src.code : null);

/**
 * A page of the book shown large (Space in the pages strip), in the same window as the Library preview. A page made
 * from a code / text file can be edited right here: its lines, with line numbers and colours; the page is drawn again
 * with the change (kept on Done, on going to another page and on closing). Other pages are shown as they are.
 */
export function PagePreview({ items, start, pageNo, onClose, onSaveCode }: { items: PageItem[]; start: number; pageNo: (it: PageItem) => number; onClose: () => void; onSaveCode: (it: PageItem, text: string) => void }) {
    const [at, setAt] = useState(Math.max(0, Math.min(start, items.length - 1)));
    const it = items[at];
    const code = pageCode(it);
    const [draft, setDraft] = useState(code?.text ?? '');
    const draftRef = useRef(draft);
    draftRef.current = draft;

    // the text of this page as it was opened: saved only when it changed
    const flush = useCallback(() => {
        const c = pageCode(it);
        if (c && draftRef.current !== c.text) onSaveCode(it, draftRef.current);
    }, [it, onSaveCode]);
    const flushRef = useRef(flush);
    flushRef.current = flush;

    const go = (d: -1 | 1) => {
        if (items.length < 2) return;
        flush();
        const n = (at + d + items.length) % items.length;
        setAt(n);
        setDraft(pageCode(items[n])?.text ?? '');
    };
    const close = () => {
        flush();
        onClose();
    };
    const closeRef = useRef(close);
    closeRef.current = close;
    const goRef = useRef(go);
    goRef.current = go;

    // Escape closes, ← / → step through the pages (not while typing in the text)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeRef.current();
            } else if (!typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                goRef.current(e.key === 'ArrowLeft' ? -1 : 1);
            } else if (!typing) e.stopImmediatePropagation(); // the book behind does not turn its pages
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    // any other page: drawn large, as it is (with what was put on it)
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [drawn, setDrawn] = useState(false);
    useEffect(() => {
        if (code || !canvasRef.current) return undefined;
        let cancelled = false;
        setDrawn(false);
        void drawThumb(it, canvasRef.current, 1100, () => cancelled).then(() => !cancelled && setDrawn(true));
        return () => {
            cancelled = true;
        };
    }, [it, code]);

    if (!it || typeof document === 'undefined') return null;
    const title = code ? `${code.name} · page ${pageNo(it)}` : `Page ${pageNo(it)}`;
    return createPortal(
        <div className="pe-preview-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
            <div className="ql" role="dialog" aria-modal="true" aria-label={`Preview: ${title}`}>
                <button type="button" className="ql-close" onClick={close} aria-label="Close preview" title="Close (Esc)">
                    <X size={26} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <h2 className="ql-title" title={title}>
                    {title}
                </h2>
                <div className="ql-frame-box">
                    <div className="ql-body">
                        {code ? (
                            <CodeEdit key={it.id} text={draft} name={code.name} firstLine={code.firstLine} onChange={setDraft} />
                        ) : (
                            <>
                                <canvas key={it.id} ref={canvasRef} className="ql-media" aria-label={title} />
                                {!drawn && (
                                    <span className="rd-page-loader" aria-hidden="true">
                                        <MediconnectSpinner label="Loading page" />
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>
                <div className="ql-foot">
                    {items.length > 1 && (
                        <div className="ql-nav" role="group" aria-label="Pages">
                            <button type="button" className="ql-nav-btn" onClick={() => go(-1)} aria-label="Previous page" title="Previous (←)">
                                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <span className="ql-nav-count">
                                {at + 1} / {items.length}
                            </span>
                            <button type="button" className="ql-nav-btn" onClick={() => go(1)} aria-label="Next page" title="Next (→)">
                                <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                    <button type="button" className="ql-action" onClick={close}>
                        {code && draft !== code.text ? 'Save' : 'Done'}
                    </button>
                </div>
            </div>
        </div>,
        document.fullscreenElement ?? document.body
    );
}
