'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MediconnectSpinner } from '@/components/ui/loaders/MediconnectSpinner';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';

import HTMLFlipBook, { FlipBookHandle, HoldData, IFlipEvent, LayoutMode, TapData } from '@/components/FlipReader/flip-book';
import { CoverDesign, defaultDesign, loadDesign, saveDesign } from '@/lib/flipreader/cover';
import { HoldFlipper, HoldHud, SkipHud, TapSkipper } from '@/lib/flipreader/gestures';
import { downloadBlob, exportMergedPdf } from '@/lib/flipreader/exportpdf';
import { takePendingFiles } from '@/lib/flipreader/handoff';
import { ACCEPT, getPageWords, loadFiles, loadPagesFromFiles } from '@/lib/flipreader/loaders';
import { duplicateItem, imageItem, insertAt, moveItem, newId, removeAt, withItems } from '@/lib/flipreader/pages';
import { pdfPageToBlob } from '@/lib/flipreader/thumbs';
import { buildIndex, getIndex, Hit, SearchIndex } from '@/lib/flipreader/search';
import type { BookDoc, ImageEdit, ImageItem, ImageSource, Overlay, PageItem, Source } from '@/lib/flipreader/types';
import { CoverEditor } from './CoverEditor';
import { BlankPage, CoverBack, CoverFront } from './covers';
import { ImageEditor } from './ImageEditor';
import { PageEditor } from './PageEditor';
import { Island, ShowBar, ThemeChoice } from './Island';
import { InsertMode, PagesTray } from './PagesTray';
import { HiddenPage, HighlightTarget, ImagePage, PdfPage, TextPage } from './pages';
import { SearchPanel } from './SearchPanel';
import { useZoom } from './useZoom';
import { useFlipbookTimeLog } from './useFlipbookTimeLog';

const PREFS_KEY = 'reader.prefs';

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsElement = HTMLDivElement & { webkitRequestFullscreen?: () => void };

const fullscreenElement = () => {
    const d = document as FsDocument;
    return d.fullscreenElement || d.webkitFullscreenElement || null;
};

/*
 * Page layout of the book when covers are on (a = absolute page index in the flip book):
 *   a=0            front cover (outside)
 *   a=1            inside of the front cover (blank)
 *   a=2 ...        the real pages of the file
 *   (one blank page is added after the last page if the count is odd, so the book ends on a full spread)
 *   next-to-last   inside of the back cover (blank)
 *   last           back cover (outside)
 * With covers off, the book is just the pages of the file.
 */
const LEAD = 2;

/** Releases the PDF files a book was using. */
function releaseSources(doc: BookDoc | null) {
    if (doc?.kind === 'pages') doc.sources.forEach((s) => s.kind === 'pdf' && void s.pdf.destroy());
}

export default function Reader() {
    const readerRef = useRef<HTMLDivElement>(null);
    const bookRef = useRef<FlipBookHandle>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const layerRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const docRef = useRef<BookDoc | null>(null);

    const [doc, setDoc] = useState<BookDoc | null>(null);
    const [design, setDesign] = useState<CoverDesign>(() => defaultDesign());
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState<{ msg: string; p?: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const [current, setCurrent] = useState(0);
    const [visible, setVisible] = useState<number[]>([0]);
    const [playing, setPlaying] = useState(false);
    // Time spent reading this book goes into Profile → Time spent, as reading.
    useFlipbookTimeLog(doc?.key ?? null, doc?.title ?? null, playing);
    const [wpm, setWpm] = useState(200);
    const [hidden, setHidden] = useState(false);
    const [mode, setMode] = useState<LayoutMode>('double'); // both pages of the spread are shown, like a dual-screen phone
    const [rotation, setRotation] = useState(0); // 0 / 90 / 180 / 270
    const [zoomed, setZoomed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [box, setBox] = useState({ w: 0, h: 0 });
    const [tick, setTick] = useState(0);
    const [delay, setDelay] = useState<number | null>(null);
    const [reduceMotion, setReduceMotion] = useState(false);

    // pinch zoom (the transform is applied straight to the DOM by the hook)
    const zoomRef = useRef<HTMLDivElement>(null);
    const { scale: zoomScale, reset: resetZoom, zoomBy } = useZoom(boxRef, zoomRef);
    // the round "reset zoom" button shows while you zoom, then fades to clear; a touch or click brings it back for a moment
    const [zoomBtnAwake, setZoomBtnAwake] = useState(false);
    const zoomBtnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wakeZoomBtn = () => {
        setZoomBtnAwake(true);
        if (zoomBtnTimer.current) clearTimeout(zoomBtnTimer.current);
        zoomBtnTimer.current = setTimeout(() => setZoomBtnAwake(false), 2200);
    };
    useEffect(() => {
        if (zoomScale > 1.01) wakeZoomBtn();
        else {
            setZoomBtnAwake(false);
            if (zoomBtnTimer.current) clearTimeout(zoomBtnTimer.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoomScale]);
    useEffect(() => () => {
        if (zoomBtnTimer.current) clearTimeout(zoomBtnTimer.current);
    }, []);

    // search
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [wantIndex, setWantIndex] = useState(false);
    const [indexInfo, setIndexInfo] = useState({ filled: 0, total: 0, done: false });
    const indexRef = useRef<SearchIndex | null>(null);
    const [highlight, setHighlight] = useState<(HighlightTarget & { page: number }) | null>(null);
    const highlightToken = useRef(0);

    // navigation + gestures
    const [pending, setPending] = useState<number | null>(null); // page a flip is heading to
    const [holdHud, setHoldHud] = useState<HoldHud | null>(null);
    const [skipHud, setSkipHud] = useState<SkipHud | null>(null);

    // day / night and eye comfort
    const [theme, setTheme] = useState<ThemeChoice>('auto');
    const [systemLight, setSystemLight] = useState(false);
    const [comfort, setComfort] = useState(false);
    const [comfortLevel, setComfortLevel] = useState(40);
    const [comfortAuto, setComfortAuto] = useState(false);
    const [invertPages, setInvertPages] = useState(true);
    const [flipBlur, setFlipBlur] = useState(true);
    const [hour, setHour] = useState(12);

    // pages tray, image editor and edits to the page list
    const [trayOpen, setTrayOpen] = useState(false);
    const [imageEditing, setImageEditing] = useState(false);
    const [annotating, setAnnotating] = useState(false);
    /** the pages of the page editor's window: the page it was opened on and every page added from it (Canva-style stack) */
    const [annotIds, setAnnotIds] = useState<string[]>([]);
    /** the book as it was when the page editor opened: Cancel goes back to it, so nothing from the window reaches the PDF */
    const annotStart = useRef<{ items: PageItem[]; history: number; sel: number } | null>(null);
    const [sel, setSel] = useState(0); // selected page (0-based, pages of the file only)
    const [insertMode, setInsertMode] = useState<InsertMode>('after');
    const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [undoCount, setUndoCount] = useState(0);
    const historyRef = useRef<PageItem[][]>([]);
    const focusRef = useRef<number | null>(null);

    const editingRef = useRef(false);
    const editorOpenRef = useRef(false); // an image or page editor is open (it handles its own Escape)
    useEffect(() => {
        editingRef.current = editing || searchOpen || trayOpen || imageEditing || annotating; // while a panel is open, page shortcuts stay quiet
        editorOpenRef.current = imageEditing || annotating;
    }, [editing, searchOpen, trayOpen, imageEditing, annotating]);

    /* ---------- derived page numbers ---------- */
    const covers = !!doc && design.covers;
    const lead = covers ? LEAD : 0;
    const count = doc?.pageCount ?? 0; // real pages
    const pad = covers && count % 2 === 1 ? 1 : 0;
    const total = !doc ? 0 : covers ? lead + count + pad + 2 : count;

    /* ---------- remembered preferences ---------- */
    useEffect(() => {
        try {
            const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
            if (typeof p.wpm === 'number') setWpm(Math.min(1000, Math.max(1, Math.round(p.wpm))));
            if (typeof p.hidden === 'boolean') setHidden(p.hidden);
            if (p.modeV2 === 'auto' || p.modeV2 === 'single' || p.modeV2 === 'double') setMode(p.modeV2);
            if (p.theme === 'auto' || p.theme === 'day' || p.theme === 'night') setTheme(p.theme);
            if (typeof p.comfort === 'boolean') setComfort(p.comfort);
            if (typeof p.comfortLevel === 'number') setComfortLevel(Math.min(100, Math.max(0, Math.round(p.comfortLevel))));
            if (typeof p.comfortAuto === 'boolean') setComfortAuto(p.comfortAuto);
            if (typeof p.invertPages === 'boolean') setInvertPages(p.invertPages);
            if (typeof p.flipBlur === 'boolean') setFlipBlur(p.flipBlur);
        } catch {
            /* ignore */
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify({ wpm, hidden, modeV2: mode, theme, comfort, comfortLevel, comfortAuto, invertPages, flipBlur }));
        } catch {
            /* ignore */
        }
    }, [wpm, hidden, mode, theme, comfort, comfortLevel, comfortAuto, invertPages, flipBlur, mounted]);

    /* ---------- day / night ---------- */
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const update = () => setSystemLight(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    // 'auto' follows the Pacewise theme (data-theme on <html>: dark / light / sepia) so the book matches the app
    const [appTheme, setAppTheme] = useState<string | null>(null);
    useEffect(() => {
        const html = document.documentElement;
        const update = () => setAppTheme(html.dataset.theme ?? null);
        update();
        const mo = new MutationObserver(update);
        mo.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
        return () => mo.disconnect();
    }, []);
    const autoNight = appTheme ? appTheme === 'dark' : !systemLight;
    const sepia = theme === 'auto' && appTheme === 'sepia';

    const night = theme === 'night' || (theme === 'auto' && autoNight);

    // the colours switch on the reader's own container, so the rest of Pacewise keeps its own theme
    useEffect(() => {
        if (readerRef.current) readerRef.current.dataset.rtheme = night ? 'night' : sepia ? 'sepia' : 'day';
    }, [night, sepia]);

    /* ---------- eye comfort: manual, or automatic from 7 pm to 7 am ---------- */
    useEffect(() => {
        const tick = () => setHour(new Date().getHours());
        tick();
        const t = setInterval(tick, 60_000);
        return () => clearInterval(t);
    }, []);
    const comfortActive = comfort || (comfortAuto && (hour >= 19 || hour < 7));
    const warm = `rgba(255, ${Math.round(200 - comfortLevel * 0.9)}, ${Math.round(150 - comfortLevel * 1.2)}, ${(0.25 + 0.55 * (comfortLevel / 100)).toFixed(2)})`;

    /* ---------- remember the cover design of each book ---------- */
    useEffect(() => {
        if (!doc) return undefined;
        const t = setTimeout(() => saveDesign(doc.key, design), 400);
        return () => clearTimeout(t);
    }, [design, doc]);

    /* ---------- accessibility: shorter flip for people who prefer reduced motion ---------- */
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduceMotion(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    /* ---------- free the PDF when leaving the page ---------- */
    useEffect(
        () => () => {
            const d = docRef.current;
            releaseSources(d);
        },
        []
    );

    /* ---------- size of the reading surface ---------- */
    useEffect(() => {
        const el = boxRef.current;
        if (!el) return undefined;
        const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    /* ---------- zoom (full screen) ---------- */
    const zoomedRef = useRef(false);
    useEffect(() => {
        zoomedRef.current = zoomed;
    }, [zoomed]);

    const toggleZoom = useCallback(async () => {
        const el = readerRef.current as FsElement | null;
        if (!el) return;

        if (zoomedRef.current || fullscreenElement()) {
            setZoomed(false);
            try {
                const d = document as FsDocument;
                if (document.fullscreenElement) await document.exitFullscreen();
                else if (d.webkitFullscreenElement) d.webkitExitFullscreen?.();
            } catch {
                /* ignore */
            }
            return;
        }

        // The CSS "fill the whole window" state is the fallback where the Fullscreen API
        // is missing (iPhone Safari) or refused.
        setZoomed(true);
        try {
            if (el.requestFullscreen) await el.requestFullscreen();
            else el.webkitRequestFullscreen?.();
        } catch {
            /* keep the CSS fallback */
        }
    }, []);

    const toggleZoomRef = useRef(toggleZoom);
    useEffect(() => {
        toggleZoomRef.current = toggleZoom;
    }, [toggleZoom]);

    useEffect(() => {
        // the user left full screen with Esc or a browser gesture
        const onChange = () => {
            if (!fullscreenElement()) setZoomed(false);
        };
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    /* ---------- rotation ---------- */
    const rotate = (dir: -1 | 1) => {
        resetZoom();
        setRotation((r) => (((r + dir * 90) % 360) + 360) % 360);
    };

    /* ---------- opening files (several images and PDFs make one book) ---------- */
    const openFiles = useCallback(
        async (files: File[]) => {
            if (files.length === 0) return;
            setError(null);
            setNotice(null);
            setPlaying(false);
            setEditing(false);
            setSearchOpen(false);
            setQuery('');
            setWantIndex(false);
            setHighlight(null);
            setPending(null);
            setTrayOpen(false);
            setImageEditing(false);
            setAnnotating(false);
            flipperRef.current?.stop();
            skipperRef.current?.cancel();
            resetZoom();
            setBusy({ msg: 'Opening…' });
            try {
                const { doc: loaded, warnings } = await loadFiles(files, (msg, p) => setBusy({ msg, p }));
                const old = docRef.current;
                docRef.current = loaded;
                historyRef.current = [];
                setUndoCount(0);
                setCurrent(0);
                setVisible([0]);
                setSel(0);
                setDesign(loadDesign(loaded.key, loaded.title) ?? defaultDesign(loaded.title));
                setDoc(loaded);
                if (warnings.length) setNotice(`Skipped: ${warnings.join(' ')}`);
                setTimeout(() => releaseSources(old), 800);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not open these files.');
            } finally {
                setBusy(null);
            }
        },
        [resetZoom]
    );

    const router = useRouter();
    const startedRef = useRef(false);
    // a PDF added from elsewhere in Pacewise arrives here and opens straight away as a flip book
    useEffect(() => {
        if (startedRef.current) return; // once (development runs effects twice; the files are already taken)
        startedRef.current = true;
        const files = takePendingFiles();
        if (files.length) void openFiles(files);
        else router.replace('/'); // nothing to open: the flip book has no start page of its own, Pacewise's home is it
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // No book (the files could not be opened): back to Pacewise's home page, after the error has been read.
    useEffect(() => {
        if (doc || busy || !error) return undefined;
        const t = setTimeout(() => router.replace('/'), 3000);
        return () => clearTimeout(t);
    }, [doc, busy, error, router]);

    const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = ''; // allow choosing the same file again
        void openFiles(files);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        void openFiles(Array.from(e.dataTransfer.files ?? []));
    };

    const pickFile = () => fileRef.current?.click();

    /* ---------- cover editing ---------- */
    const patchDesign = (patch: Partial<CoverDesign>) => setDesign((d) => ({ ...d, ...patch }));
    const resetDesign = () => doc && setDesign(defaultDesign(doc.title));

    /* ---------- navigation ---------- */
    const api = () => bookRef.current?.pageFlip();
    const goNext = () => void api()?.flipNext();
    const goPrev = () => void api()?.flipPrev();
    // the page box counts real pages only (covers are not numbered)
    const gotoPage = (n: number) => api()?.flip(n - 1 + lead);

    /* ---------- go to any page (whole-book index). Far jumps animate only the last sheet. ---------- */
    const navigate = (abs: number) => {
        const target = Math.min(Math.max(0, abs), Math.max(0, total - 1));
        setPending(target); // start drawing the destination right away
        bookRef.current?.pageFlip().flip(target);
    };

    useEffect(() => {
        if (pending !== null && visible.includes(pending)) setPending(null);
    }, [visible, pending]);

    /* ---------- search ---------- */
    const openSearch = () => {
        if (!doc) return;
        setSearchOpen(true);
        setWantIndex(true); // starts reading the text of every page
    };

    useEffect(() => {
        if (!doc || !wantIndex) return undefined;
        const index = getIndex(doc);
        indexRef.current = index;
        setIndexInfo({ filled: index.filled, total: index.total, done: index.done });
        const signal = { cancelled: false };
        let last = 0;
        void buildIndex(doc, index, signal, (filled, totalPages) => {
            const now = performance.now();
            if (filled >= totalPages || now - last > 150) {
                last = now;
                setIndexInfo({ filled, total: totalPages, done: filled >= totalPages });
            }
        });
        return () => {
            signal.cancelled = true;
        };
    }, [doc, wantIndex]);

    const openHit = (hit: Hit) => {
        setPlaying(false);
        setHighlight({ page: hit.page, q: hit.q, occurrence: hit.occurrence, token: ++highlightToken.current });
        navigate(hit.page + lead);
        if (window.innerWidth < 760) setSearchOpen(false); // small screens: get the panel out of the way
    };

    /* ---------- editing the page list (image and PDF books) ---------- */
    const pagesDoc = doc?.kind === 'pages' ? doc : null;

    /** Applies a change to the page list, remembering the old list so it can be undone. */
    const editPages = (build: (items: PageItem[]) => PageItem[], extra: Source[] = [], focus?: number) => {
        const cur = docRef.current;
        if (!cur || cur.kind !== 'pages') return;
        const items = build(cur.items);
        if (items === cur.items) return;
        historyRef.current.push(cur.items);
        if (historyRef.current.length > 40) historyRef.current.shift();
        setUndoCount(historyRef.current.length);
        const next = withItems(cur, items, extra);
        docRef.current = next;
        if (focus !== undefined) focusRef.current = Math.min(Math.max(0, focus), Math.max(0, items.length - 1));
        setHighlight(null); // match positions refer to the old page list
        setDoc(next);
    };

    // once the book shows the new page list, go to the page that was just added / moved
    useEffect(() => {
        const f = focusRef.current;
        if (f === null) return;
        focusRef.current = null;
        setSel(f);
        navigate(f + lead);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc && doc.kind === 'pages' ? doc.rev : -1]);

    const pageDelete = () => editPages((items) => removeAt(items, sel), [], Math.min(sel, (docRef.current?.pageCount ?? 1) - 2));
    const pageMove = (dir: -1 | 1) => editPages((items) => moveItem(items, sel, dir), [], sel + dir);
    const pageDuplicate = () => editPages((items) => insertAt(items, sel + 1, [duplicateItem(items[sel])]), [], sel + 1);
    const pageEditApply = (edit: ImageEdit) => {
        editPages((items) => items.map((it, i) => (i === sel && it.type === 'image' ? { ...it, edit } : it)), [], sel);
        setImageEditing(false);
    };

    /** This page's layers, plus any pages a document written on it runs on to (added right after it). */
    const withAnnotation = (items: PageItem[], overlays: Overlay[], extraPages: ImageSource[]) => {
        const next = items.map((it, i) => (i === sel ? { ...it, overlays } : it));
        if (!extraPages.length) return next;
        const added = extraPages.map((src) => imageItem(src));
        addToWindow(added.map((a) => a.id)); // pages a document runs on to belong to the editor's window too
        return insertAt(next, sel + 1, added);
    };
    const addToWindow = (ids: string[]) => setAnnotIds((cur) => [...cur, ...ids.filter((id) => !cur.includes(id))]);

    const pageAnnotateApply = (overlays: Overlay[], extraPages: ImageSource[] = []) => {
        editPages((items) => withAnnotation(items, overlays, extraPages), extraPages, sel);
        annotStart.current = null; // applied: the window's pages are now part of the PDF
        setAnnotating(false);
    };

    /** Keep what was added to this page, then open the previous (-1) or next (+1) page in the editor. */
    const pageAnnotateGo = (overlays: Overlay[], delta: number, extraPages: ImageSource[] = []) => {
        const n = (pagesDoc?.items.length ?? 0) + extraPages.length;
        const to = sel + delta;
        if (to < 0 || to >= n) return;
        editPages((items) => withAnnotation(items, overlays, extraPages), extraPages, to);
    };

    /**
     * From the page editor: keep this page's work, put a new page right after it (after any pages its document runs on
     * to) and open that page in the editor, like Canva's add / duplicate page. `blank` is a white page; without it the
     * current page is copied with everything on it.
     */
    const pageAnnotateInsert = (overlays: Overlay[], extraPages: ImageSource[] = [], blank?: ImageSource) => {
        const at = sel + 1 + extraPages.length;
        editPages(
            (items) => {
                const next = withAnnotation(items, overlays, extraPages);
                const added = blank ? imageItem(blank) : duplicateItem(next[sel]);
                addToWindow([added.id]);
                return insertAt(next, at, [added]);
            },
            blank ? [...extraPages, blank] : extraPages,
            at
        );
    };

    /** From the page editor's page bar: keep this page's work and hide / show the page (left out of the book and the PDF). */
    const pageAnnotateHide = (overlays: Overlay[], hidden: boolean) => {
        editPages((items) => items.map((it, i) => (i === sel ? { ...it, overlays, hidden } : it)), [], sel);
    };

    /**
     * From a page in the page editor's stack (not the one being edited): hide / show it, lock / unlock everything on it,
     * duplicate it, delete it or add a blank page after it. The editor stays on its own page (only its number may move).
     */
    const pageWindowOp = (op: 'hide' | 'show' | 'lock' | 'unlock' | 'duplicate' | 'delete' | 'blank', index: number, blank?: ImageSource) => {
        const cur = docRef.current;
        if (!cur || cur.kind !== 'pages' || !cur.items[index] || index === sel) return;
        const target = cur.items[index];
        const after = index < sel ? sel + 1 : sel; // the edited page's place once a page is added before it
        if (op === 'hide' || op === 'show') {
            editPages((items) => items.map((it, i) => (i === index ? { ...it, hidden: op === 'hide' } : it)), [], sel);
        } else if (op === 'lock' || op === 'unlock') {
            editPages((items) => items.map((it, i) => (i === index ? { ...it, overlays: it.overlays.map((o) => ({ ...o, locked: op === 'lock' })) } : it)), [], sel);
        } else if (op === 'duplicate') {
            const copy = duplicateItem(target);
            addToWindow([copy.id]);
            editPages((items) => insertAt(items, index + 1, [copy]), [], after);
        } else if (op === 'blank' && blank) {
            const page = imageItem(blank);
            addToWindow([page.id]);
            editPages((items) => insertAt(items, index + 1, [page]), [blank], after);
        } else if (op === 'delete' && cur.items.length > 1) {
            editPages((items) => removeAt(items, index), [], index < sel ? sel - 1 : sel);
        }
    };

    /**
     * Cancel in the page editor: the window is separate from the PDF until Apply, so everything done in it (new and
     * duplicated pages, hidden / locked pages, edits on any of its pages) is dropped and the book is as it was.
     */
    /** Deleting the page being edited: go to the nearest other page of the window (never into the rest of the PDF). */
    const pageAnnotateDelete = () => {
        const cur = docRef.current;
        if (!cur || cur.kind !== 'pages' || cur.items.length <= 1) return;
        const gone = cur.items[sel].id;
        const rest = cur.items.map((it, i) => ({ id: it.id, i })).filter((w) => w.id !== gone && annotIds.includes(w.id));
        if (rest.length === 0) {
            // the window's only page: delete it and close the editor, as before
            annotStart.current = null;
            setAnnotating(false);
            pageDelete();
            return;
        }
        const next = rest.find((w) => w.i > sel) ?? rest[rest.length - 1];
        setAnnotIds((ids) => ids.filter((id) => id !== gone));
        editPages((items) => removeAt(items, sel), [], next.i > sel ? next.i - 1 : next.i);
    };

    /** Document mode, leaving it: the written page becomes the page being edited (same page, its layers kept). */
    const pageAnnotateReplace = (src: ImageSource) => {
        editPages((items) => items.map((it, i) => (i === sel ? { ...imageItem(src), id: it.id, overlays: it.overlays, hidden: it.hidden } : it)), [src], sel);
    };

    const pageAnnotateCancel = () => {
        const start = annotStart.current;
        const cur = docRef.current;
        annotStart.current = null;
        setAnnotating(false);
        if (!start || !cur || cur.kind !== 'pages' || cur.items === start.items) return;
        historyRef.current.length = Math.min(historyRef.current.length, start.history);
        setUndoCount(historyRef.current.length);
        const next = withItems(cur, start.items);
        docRef.current = next;
        focusRef.current = Math.min(start.sel, start.items.length - 1);
        setHighlight(null);
        setDoc(next);
    };

    const undoPages = () => {
        const prev = historyRef.current.pop();
        const cur = docRef.current;
        if (!prev || !cur || cur.kind !== 'pages') return;
        setUndoCount(historyRef.current.length);
        const next = withItems(cur, prev);
        docRef.current = next;
        focusRef.current = Math.min(sel, prev.length - 1);
        setHighlight(null);
        setDoc(next);
    };

    const pageAdd = async (files: File[]) => {
        const cur = docRef.current;
        if (!cur || cur.kind !== 'pages') return;
        setBusy({ msg: 'Adding pages…' });
        try {
            const { items: add, sources, warnings } = await loadPagesFromFiles(files, (msg, p) => setBusy({ msg, p }));
            if (warnings.length) setNotice(`Skipped: ${warnings.join(' ')}`);
            if (add.length === 0) return;
            const at = insertMode === 'end' || cur.items.length === 0 ? cur.items.length : insertMode === 'before' ? sel : sel + 1;
            editPages((items) => insertAt(items, at, add), sources, at);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not add these files.');
        } finally {
            setBusy(null);
        }
    };

    /** Turns a PDF page into a picture, so it can be cropped and adjusted like any image. */
    const pageConvert = async () => {
        const cur = docRef.current;
        const item = cur?.kind === 'pages' ? cur.items[sel] : undefined;
        if (!item || item.type !== 'pdf') return;
        setBusy({ msg: 'Converting page…' });
        try {
            const { blob, width, height } = await pdfPageToBlob(item);
            const src: ImageSource = { id: newId(), kind: 'image', name: `${item.src.name} p.${item.index + 1}`, blob, width, height };
            editPages((items) => items.map((it, i) => (i === sel ? { ...imageItem(src), overlays: it.overlays } : it)), [src], sel);
        } catch {
            setError('Could not convert this page.');
        } finally {
            setBusy(null);
        }
    };

    const pageExport = async () => {
        const cur = docRef.current;
        if (!cur || cur.kind !== 'pages') return;
        setExporting({ done: 0, total: cur.items.length });
        try {
            const blob = await exportMergedPdf(cur, (done, total) => setExporting({ done, total }));
            downloadBlob(blob, `${cur.title}.pdf`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not build the PDF.');
        } finally {
            setExporting(null);
        }
    };

    /* ---------- gestures: hold to fast-flip, repeated taps to skip ---------- */
    const visibleRef = useRef(visible);
    const totalRef = useRef(total);
    const navRef = useRef(navigate);
    const openSearchRef = useRef(openSearch);
    useEffect(() => {
        visibleRef.current = visible;
        totalRef.current = total;
        navRef.current = navigate;
        openSearchRef.current = openSearch;
    });

    const flipperRef = useRef<HoldFlipper | null>(null);
    const skipperRef = useRef<TapSkipper | null>(null);
    useEffect(() => {
        const flipper = new HoldFlipper(
            () => bookRef.current?.pageFlip(),
            (dir) => {
                const v = visibleRef.current;
                return dir === 1 ? v.includes(totalRef.current - 1) : v.includes(0);
            },
            setHoldHud
        );
        const skipper = new TapSkipper({
            getBase: (dir) => {
                const v = visibleRef.current;
                return dir === 1 ? Math.max(...v) : Math.min(...v);
            },
            getTotal: () => totalRef.current,
            go: (abs) => navRef.current(abs),
            onHud: setSkipHud,
        });
        flipperRef.current = flipper;
        skipperRef.current = skipper;

        // a held press must never outlive the window or tab
        const stop = () => flipper.stop();
        const onHidden = () => {
            if (document.hidden) flipper.stop();
        };
        window.addEventListener('blur', stop);
        document.addEventListener('visibilitychange', onHidden);
        return () => {
            window.removeEventListener('blur', stop);
            document.removeEventListener('visibilitychange', onHidden);
            flipper.stop();
            skipper.cancel();
        };
    }, []);

    /** A tap on the left/right side. Returns true when it was absorbed into a multi-page skip. */
    const onTap = (e: IFlipEvent<TapData>) => skipperRef.current?.tap(e.data.dir) === true;

    const onHold = (e: IFlipEvent<HoldData>) => {
        if (e.data.phase === 'start') {
            skipperRef.current?.cancel();
            setPlaying(false);
            flipperRef.current?.start(e.data.dir);
        } else {
            flipperRef.current?.stop();
        }
    };

    /* ---------- auto flip: time per spread = words on screen / WPM ---------- */
    useEffect(() => {
        if (!playing || !doc) return undefined;
        const book = bookRef.current?.pageFlip();
        if (!book) return undefined;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        (async () => {
            const shown = book.getVisiblePages();
            if (shown.includes(total - 1)) {
                setPlaying(false); // reached the end
                return;
            }
            // covers and blank pages have no words
            const real = shown.map((a) => a - lead).filter((i) => i >= 0 && i < count);
            let words = 0;
            try {
                const counts = await Promise.all(real.map((i) => getPageWords(doc, i)));
                words = counts.reduce((a, b) => a + b, 0);
            } catch {
                /* use the default delay */
            }
            if (cancelled) return;

            // pages without text (covers, scans, pictures) get a fixed 3 seconds
            const ms = words > 0 ? Math.max(600, (words / wpm) * 60000) : 3000;
            setDelay(ms);
            timer = setTimeout(() => {
                if (!book.flipNext()) setTick((t) => t + 1); // refused (e.g. user is dragging): retry
            }, ms);
        })();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
        // `current` changes after each completed flip, which schedules the next one
    }, [playing, wpm, current, tick, doc, total, lead, count]);

    useEffect(() => {
        if (!playing) setDelay(null);
    }, [playing]);

    /* ---------- keyboard ---------- */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                if (docRef.current) {
                    e.preventDefault();
                    openSearchRef.current();
                }
                return;
            }
            if (editingRef.current) {
                if (e.key === 'Escape') {
                    setEditing(false);
                    setSearchOpen(false);
                    if (!editorOpenRef.current) setTrayOpen(false); // an open editor handles its own Escape and keeps the pages panel
                }
                return;
            }
            const t = e.target as HTMLElement | null;
            if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
            if (t && t.tagName === 'BUTTON' && e.key === ' ') return;
            const book = bookRef.current?.pageFlip();
            switch (e.key) {
                case 'ArrowRight':
                case 'PageDown':
                    book?.flipNext();
                    break;
                case 'ArrowLeft':
                case 'PageUp':
                    book?.flipPrev();
                    break;
                case ' ':
                    e.preventDefault();
                    if (docRef.current) setPlaying((p) => !p);
                    break;
                case 'h':
                case 'H':
                    setHidden((h) => !h);
                    break;
                case 'f':
                case 'F':
                    void toggleZoomRef.current();
                    break;
                case '/':
                    e.preventDefault();
                    openSearchRef.current();
                    break;
                case 'p':
                case 'P':
                    if (docRef.current?.kind === 'pages') setTrayOpen((o) => !o);
                    break;
                case 'e':
                case 'E':
                    if (docRef.current) setEditing(true);
                    break;
                case 'Escape':
                    // real full screen is left by the browser itself; this covers the CSS fallback
                    if (zoomedRef.current && !fullscreenElement()) setZoomed(false);
                    break;
                default:
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    /* ---------- what is on screen, for the page box and progress bar ---------- */
    const realVisible = visible.map((a) => a - lead).filter((i) => i >= 0 && i < count);
    let pageLabel = '';
    if (doc) {
        if (realVisible.length) pageLabel = String(realVisible[0] + 1);
        else if (covers && visible.includes(0)) pageLabel = 'Cover';
        else if (covers && visible.includes(total - 1)) pageLabel = 'Back';
    }
    const progress = total ? (Math.max(...visible) + 1) / total : 0;

    const syncVisible = (book: { getVisiblePages: () => number[] }) => setVisible(book.getVisiblePages());

    // keep the selected page in the tray on a page that is on screen (unless it is already on screen)
    useEffect(() => {
        if (realVisible.length && !realVisible.includes(sel)) setSel(realVisible[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    /* ---------- render ---------- */
    const ratio = doc?.kind === 'pages' ? doc.ratio : 800 / 600;
    const baseW = doc?.kind === 'pages' ? 1000 : 600;

    // When rotated by 90 / 270 degrees the book is laid out in the swapped space and
    // then turned, so it still fills the screen.
    const sideways = rotation % 180 !== 0;
    const surfaceW = sideways ? box.h : box.w;
    const surfaceH = sideways ? box.w : box.h;

    // while fast-flipping, don't draw pages that will be gone a moment later
    const renderOn = !(holdHud && holdHud.pps >= 4);
    const quality = Math.min(4, Math.ceil(zoomScale * 2) / 2); // draw sharper while zoomed in
    const hl = (i: number) => (highlight && highlight.page === i ? highlight : null);

    const contentPages = !doc
        ? []
        : doc.kind === 'pages'
          ? doc.items.map((it, i) => {
                const active = renderOn && (Math.abs(i + lead - current) <= 4 || (pending !== null && Math.abs(i + lead - pending) <= 2));
                const q = realVisible.includes(i) ? quality : 1;
                return it.hidden ? (
                    <HiddenPage key={it.id} night={night} />
                ) : it.type === 'pdf' ? (
                    <PdfPage key={it.id} pdf={it.src.pdf} index={it.index} active={active} quality={q} highlight={hl(i)} dark={night && invertPages} overlays={it.overlays} />
                ) : (
                    <ImagePage key={it.id} item={it} active={active} quality={q} night={night} invert={night && invertPages} />
                );
            })
          : doc.pages.map((p, i) => <TextPage key={i} data={p} index={i} highlight={hl(i)} night={night} />);

    const bookPages = !covers
        ? contentPages
        : [
              <CoverFront key="cover-front" design={design} />,
              <BlankPage key="inside-front" />,
              ...contentPages,
              ...(pad ? [<BlankPage key="pad" />] : []),
              <BlankPage key="inside-back" />,
              <CoverBack key="cover-back" design={design} />,
          ];

    return (
        <div
            ref={readerRef}
            className="reader"
            data-zoom={zoomed}
            data-dragover={dragOver}
            onPointerDown={() => {
                if (zoomScale > 1.01) wakeZoomBtn();
            }}
            onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
        >
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={onPick} />

            <div className="rd-box" ref={boxRef} role="region" aria-label={doc ? `Book: ${doc.title}` : 'Book reader'}>
                <div className="rd-zoom" ref={zoomRef}>
                {doc && box.w > 0 && (
                    <div
                        className="rd-rot"
                        style={{
                            width: surfaceW,
                            height: surfaceH,
                            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                        }}
                    >
                        <HTMLFlipBook
                            key={`${doc.id}-${covers ? 'covers' : 'plain'}`}
                            ref={bookRef}
                            size="stretch"
                            layoutMode={mode}
                            rotation={rotation}
                            zoom={zoomScale}
                            onTap={onTap}
                            onHold={onHold}
                            width={baseW}
                            height={Math.round(baseW * ratio)}
                            minWidth={260}
                            maxWidth={4000}
                            maxHeight={Math.max(200, surfaceH)}
                            showCover
                            paperColor={night ? '#141518' : sepia ? '#f4ecd8' : '#fbfbfa'}
                            motionBlur={reduceMotion || !flipBlur ? 0 : 1}
                            flippingTime={reduceMotion ? 120 : 800}
                            maxShadowOpacity={0.8}
                            mobileScrollSupport={false}
                            onInit={(e) => {
                                setCurrent(e.data.page);
                                syncVisible(e.object);
                            }}
                            onUpdate={(e) => {
                                setCurrent(e.data.page);
                                syncVisible(e.object);
                            }}
                            onFlip={(e) => {
                                setCurrent(e.data);
                                syncVisible(e.object);
                            }}
                            onChangeOrientation={() => setTick((t) => t + 1)}
                            onChangeState={(e) => {
                                // phones and tablets: the glass stops refracting while pages move (see globals.css)
                                const r = readerRef.current;
                                if (r) r.dataset.flipping = String(e.data === 'flipping' || e.data === 'user_fold');
                            }}
                        >
                            {bookPages}
                        </HTMLFlipBook>
                    </div>
                )}
                </div>
            </div>

            {doc && (
                <p className="rd-sr" aria-live="polite">
                    {pageLabel ? (/^\d+$/.test(pageLabel) ? `Page ${pageLabel} of ${count}` : pageLabel) : ''}
                </p>
            )}

            {/* no start page of its own: until the book is open, Mediconnect's loader (with no book, it goes to Pacewise's home) */}
            {!doc && !busy && !error && (
                <div className="rd-page-loader" aria-hidden="true">
                    <MediconnectSpinner label="Opening the book" />
                </div>
            )}

            {doc && count === 0 && !covers && !busy && (
                <div className="rd-card">
                    <h1>No pages</h1>
                    <p>Every page was removed. Add images or PDFs to continue, or undo the last change.</p>
                    <button className="rd-primary" onClick={() => setTrayOpen(true)}>
                        Open pages
                    </button>
                </div>
            )}

            {busy && (
                <div className="rd-card" role="status" aria-live="polite">
                    <div className="rd-spinner" aria-hidden="true" />
                    <p>{busy.msg}</p>
                    {busy.p !== undefined && (
                        <div className="rd-progress">
                            <span style={{ width: `${Math.round(busy.p * 100)}%` }} />
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="rd-toast" role="alert">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {notice && (
                <div className="rd-toast" data-kind="info" role="status">
                    <span>{notice}</span>
                    <button onClick={() => setNotice(null)}>Dismiss</button>
                </div>
            )}

            {holdHud && (
                <div className="rd-hud" data-side={holdHud.dir === 1 ? 'right' : 'left'} role="status">
                    <span aria-hidden="true">{holdHud.dir === 1 ? <ChevronsRight size={18} strokeWidth={1.75} /> : <ChevronsLeft size={18} strokeWidth={1.75} />}</span>
                    <span>{holdHud.mult.toFixed(1)}×</span>
                    <small>fast flip</small>
                </div>
            )}

            {skipHud && (
                <div className="rd-hud" data-side={skipHud.dir === 1 ? 'right' : 'left'} role="status">
                    <span aria-hidden="true">{skipHud.dir === 1 ? <ChevronsRight size={18} strokeWidth={1.75} /> : <ChevronsLeft size={18} strokeWidth={1.75} />}</span>
                    <span>{skipHud.label}</span>
                </div>
            )}

            {zoomScale > 1.01 && (
                <button
                    className="rd-zoomchip"
                    data-faded={!zoomBtnAwake}
                    onClick={() => {
                        // a faded button first wakes up; tapping it while it shows resets the zoom
                        if (zoomBtnAwake) resetZoom();
                        else wakeZoomBtn();
                    }}
                    aria-label="Reset zoom"
                    title="Reset zoom"
                >
                    <X size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
            )}

            {mounted && (
                <div ref={layerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
                    <Island
                        boundsRef={layerRef}
                        hidden={hidden}
                        away={searchOpen || editing || trayOpen || imageEditing || annotating}
                        hasBook={!!doc}
                        pageLabel={pageLabel}
                        pageTotal={count}
                        playing={playing}
                        wpm={wpm}
                        seconds={delay === null ? null : delay / 1000}
                        mode={mode}
                        zoomed={zoomed}
                        searchOpen={searchOpen}
                        pagesOpen={trayOpen}
                        canEditPages={!!pagesDoc}
                        theme={theme}
                        night={night}
                        onTheme={setTheme}
                        comfort={comfort}
                        comfortLevel={comfortLevel}
                        comfortAuto={comfortAuto}
                        comfortActive={comfortActive}
                        onComfort={setComfort}
                        onComfortLevel={setComfortLevel}
                        onComfortAuto={setComfortAuto}
                        invertPages={invertPages}
                        onInvertPages={setInvertPages}
                        flipBlur={flipBlur}
                        onFlipBlur={setFlipBlur}
                        onPrev={goPrev}
                        onNext={goNext}
                        onGoto={gotoPage}
                        onTogglePlay={() => setPlaying((p) => !p)}
                        onWpm={setWpm}
                        onMode={setMode}
                        onRotate={rotate}
                        onZoom={() => void toggleZoom()}
                        zoomScale={zoomScale}
                        onZoomIn={() => zoomBy(1.4)}
                        onZoomOut={() => zoomBy(1 / 1.4)}
                        onSearch={() => (searchOpen ? setSearchOpen(false) : openSearch())}
                        onPages={() => setTrayOpen((o) => !o)}
                        onEditCover={() => setEditing(true)}
                        onOpen={pickFile}
                        onHide={() => setHidden(true)}
                    />
                    <ShowBar hidden={hidden} progress={progress} onShow={() => setHidden(false)} />
                </div>
            )}

            {searchOpen && doc && (
                <SearchPanel
                    index={indexRef.current}
                    progress={indexInfo}
                    query={query}
                    onQuery={setQuery}
                    onOpenHit={openHit}
                    onClose={() => setSearchOpen(false)}
                />
            )}

            {trayOpen && pagesDoc && (
                <PagesTray
                    doc={pagesDoc}
                    selected={sel}
                    onSelect={(i) => {
                        setSel(i);
                        navigate(i + lead);
                    }}
                    insertMode={insertMode}
                    onInsertMode={setInsertMode}
                    onAddFiles={(files) => void pageAdd(files)}
                    onEdit={() => setImageEditing(true)}
                    onAnnotate={() => {
                        const it = pagesDoc?.items[sel];
                        setAnnotIds(it ? [it.id] : []);
                        annotStart.current = pagesDoc ? { items: pagesDoc.items, history: historyRef.current.length, sel } : null;
                        setAnnotating(true);
                    }}
                    onConvert={() => void pageConvert()}
                    onDuplicate={pageDuplicate}
                    onMove={pageMove}
                    onDelete={pageDelete}
                    onUndo={undoPages}
                    canUndo={undoCount > 0}
                    onExport={() => void pageExport()}
                    exporting={exporting}
                    onClose={() => setTrayOpen(false)}
                />
            )}

            {imageEditing && pagesDoc?.items[sel]?.type === 'image' && (
                <ImageEditor
                    key={pagesDoc.items[sel].id}
                    item={pagesDoc.items[sel] as ImageItem}
                    onApply={pageEditApply}
                    onCancel={() => setImageEditing(false)}
                />
            )}

            {annotating && pagesDoc?.items[sel] && (
                <PageEditor key={pagesDoc.items[sel].id} item={pagesDoc.items[sel]} onApply={pageAnnotateApply} onCancel={pageAnnotateCancel} pageNo={sel + 1} pageCount={pagesDoc.items.length} onGo={pageAnnotateGo} onDeletePage={pageAnnotateDelete} onInsertPage={pageAnnotateInsert} onHidePage={pageAnnotateHide} windowPages={pagesDoc.items.map((item, index) => ({ item, index })).filter((w) => annotIds.includes(w.item.id))} onWindowOp={pageWindowOp} bookRatio={pagesDoc.ratio} onReplacePage={pageAnnotateReplace} />
            )}

            {editing && doc && (
                <CoverEditor design={design} onChange={patchDesign} onReset={resetDesign} onClose={() => setEditing(false)} />
            )}

            <div className="rd-comfort" aria-hidden="true" style={{ backgroundColor: comfortActive ? warm : 'rgba(255, 255, 255, 0)' }} />
        </div>
    );
}
