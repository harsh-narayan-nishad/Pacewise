'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Droplet, Eye, FolderOpen, LayoutGrid, Maximize2, Minimize2, Moon, Pause, PenLine, Play, RectangleVertical, RotateCcw, RotateCw, Search, Sun, SunMoon, Waves, ZoomIn, ZoomOut } from 'lucide-react';

import type { LayoutMode } from '@/components/FlipReader/flip-book';

export type ThemeChoice = 'auto' | 'day' | 'night';
import LiquidGlass from '@/components/FlipReader/ui/LiquidGlass';
import { formatDuration } from '@/lib/flipreader/readingtime';
import { useReadingTime } from './useReadingTime';
import { useRouter } from 'next/navigation';
import { useReadingDispatch } from '@/contexts/ReadingContext';
import { startSwitchLoader } from '@/lib/switchLoader';
import { BRAND_NAME } from '@/lib/brand';

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/* ------------------------------ icons ------------------------------ */

const ICONS = {
    prev: ChevronLeft,
    next: ChevronRight,
    play: Play,
    pause: Pause,
    hide: ChevronDown,
    chevron: ChevronDown,
    open: FolderOpen,
    edit: PenLine,
    search: Search,
    rotL: RotateCcw,
    rotR: RotateCw,
    expand: Maximize2,
    shrink: Minimize2,
    one: RectangleVertical,
    two: BookOpen,
    pages: LayoutGrid,
    sun: Sun,
    moon: Moon,
    auto: SunMoon,
    eye: Eye,
    drop: Droplet,
    blur: Waves,
    zin: ZoomIn,
    zout: ZoomOut,
} as const;

type IconName = keyof typeof ICONS;

/** Icons are lucide, like the rest of Pacewise: rounded 1.75 stroke, sized by the caller. */
function Icon({ d, fill = false, size = 20 }: { d: IconName; fill?: boolean; size?: number }) {
    const Cmp = ICONS[d];
    return <Cmp width={size} height={size} strokeWidth={1.75} fill={fill ? 'currentColor' : 'none'} aria-hidden="true" />;
}

const PATH = Object.fromEntries(Object.keys(ICONS).map((k) => [k, k])) as { [K in IconName]: K };

function GripIcon() {
    return (
        <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor" aria-hidden="true">
            {[4, 10, 16].map((y) => (
                <React.Fragment key={y}>
                    <circle cx="3" cy={y} r="1.5" />
                    <circle cx="9" cy={y} r="1.5" />
                </React.Fragment>
            ))}
        </svg>
    );
}

/* --------------------------- dragging --------------------------- */

interface Pos {
    x: number; // 0..1 across the free space
    y: number;
}

/**
 * Lets the island be dragged anywhere inside `boundsRef` by its grip. The position is a fraction of the free
 * space, so it stays valid when the screen is resized or rotated, and it is remembered in localStorage.
 */
function useDraggable(id: string, defaultPos: Pos, boundsRef: React.RefObject<HTMLDivElement | null>) {
    const [pos, setPos] = useState<Pos>(defaultPos);
    const posRef = useRef<Pos>(defaultPos);
    const wrapRef = useRef<HTMLDivElement>(null);
    const drag = useRef<{ sx: number; sy: number; x0: number; y0: number; fw: number; fh: number } | null>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(`reader.pos.${id}`);
            if (!raw) return;
            const p = JSON.parse(raw);
            if (typeof p?.x === 'number' && typeof p?.y === 'number') {
                const next = { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
                posRef.current = next;
                setPos(next);
            }
        } catch {
            /* storage unavailable */
        }
    }, [id]);

    const grip = {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
            const b = boundsRef.current?.getBoundingClientRect();
            const p = wrapRef.current?.getBoundingClientRect();
            if (!b || !p) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
                sx: e.clientX,
                sy: e.clientY,
                x0: posRef.current.x,
                y0: posRef.current.y,
                fw: Math.max(1, b.width - p.width),
                fh: Math.max(1, b.height - p.height),
            };
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
            const d = drag.current;
            if (!d) return;
            const next = { x: clamp(d.x0 + (e.clientX - d.sx) / d.fw, 0, 1), y: clamp(d.y0 + (e.clientY - d.sy) / d.fh, 0, 1) };
            posRef.current = next;
            setPos(next);
        },
        onPointerUp: () => {
            if (!drag.current) return;
            drag.current = null;
            try {
                localStorage.setItem(`reader.pos.${id}`, JSON.stringify(posRef.current));
            } catch {
                /* ignore */
            }
        },
    };

    const style: React.CSSProperties = {
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        // left/top are % of the container; this shift keeps the island fully inside it
        transform: `translate(${-pos.x * 100}%, ${-pos.y * 100}%)`,
    };
    return { wrapRef, style, grip: { ...grip, onPointerCancel: grip.onPointerUp } };
}

/* ------------------------------ pieces ------------------------------ */

function PageJump({ label, total, onGoto, disabled }: { label: string; total: number; onGoto: (n: number) => void; disabled: boolean }) {
    const [draft, setDraft] = useState(label);
    useEffect(() => setDraft(label), [label]);

    const commit = () => {
        const v = parseInt(draft, 10);
        if (Number.isFinite(v) && total > 0) onGoto(clamp(v, 1, total));
        else setDraft(label);
    };

    return (
        <label className="rd-jump">
            <input
                className="rd-num"
                type="text"
                inputMode="numeric"
                value={disabled ? '' : draft}
                disabled={disabled}
                aria-label="Go to page"
                onFocus={(e: { currentTarget: HTMLInputElement }) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        commit();
                        e.currentTarget.blur();
                    }
                }}
            />
            <span>/ {total}</span>
        </label>
    );
}

/* ------------------------------ the island ------------------------------ */

export interface IslandProps {
    boundsRef: React.RefObject<HTMLDivElement | null>;
    /** the reader hid the controls: only the thin bar is shown */
    hidden: boolean;
    /** a search / editor / pages panel is open: the island steps aside */
    away: boolean;
    hasBook: boolean;
    pageLabel: string;
    pageTotal: number;
    playing: boolean;
    wpm: number;
    seconds: number | null;
    mode: LayoutMode;
    zoomed: boolean;
    searchOpen: boolean;
    pagesOpen: boolean;
    canEditPages: boolean;
    /** day / night / follow the system */
    theme: ThemeChoice;
    /** the theme that is actually showing */
    night: boolean;
    onTheme: (t: ThemeChoice) => void;
    /** eye comfort: a warm film over the screen */
    comfort: boolean;
    comfortLevel: number;
    comfortAuto: boolean;
    comfortActive: boolean;
    onComfort: (on: boolean) => void;
    onComfortLevel: (level: number) => void;
    onComfortAuto: (on: boolean) => void;
    /** invert PDF pages in night mode */
    invertPages: boolean;
    onInvertPages: (on: boolean) => void;
    /** the soft blur while a page turns */
    flipBlur: boolean;
    onFlipBlur: (on: boolean) => void;
    onPrev: () => void;
    onNext: () => void;
    onGoto: (page: number) => void;
    onTogglePlay: () => void;
    onWpm: (wpm: number) => void;
    onMode: (mode: LayoutMode) => void;
    onRotate: (direction: -1 | 1) => void;
    onZoom: () => void;
    /** zoom the page with buttons (1 = not zoomed) */
    zoomScale: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onSearch: () => void;
    onPages: () => void;
    onEditCover: () => void;
    onOpen: () => void;
    onHide: () => void;
}

/**
 * Every control lives in this one glass container, like an iPhone notification / Dynamic Island: a small pill
 * with Pacewise (home), today's reading time and the page, which opens into the full set of controls when tapped.
 */
export function Island(p: IslandProps) {
    const [open, setOpen] = useState(false);
    const { wrapRef, style, grip } = useDraggable('island', { x: 0.5, y: 0.012 }, p.boundsRef);
    const router = useRouter();
    const dispatch = useReadingDispatch();
    /** "Pacewise" in the bar: back to the software's home page (the same as the navbar's Pacewise). */
    const goHome = () => {
        dispatch({ type: 'CLEAR_STORY' });
        startSwitchLoader('home', '/');
        router.push('/');
    };
    const reading = useReadingTime(p.hasBook, p.playing);

    // the glass is as tall as its content, so it can animate between the pill and the open panel
    const innerRef = useRef<HTMLDivElement>(null);
    const [h, setH] = useState(40);
    useLayoutEffect(() => {
        const el = innerRef.current;
        if (!el) return undefined;
        const measure = () => setH(el.offsetHeight);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // step aside while another panel is open or the controls are hidden
    const away = p.away || p.hidden;
    useEffect(() => {
        if (away) setOpen(false);
    }, [away]);

    // tapping anywhere else folds it back into a pill
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e: PointerEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', onDown, true);
        return () => document.removeEventListener('pointerdown', onDown, true);
    }, [open, wrapRef]);

    const off = !p.hasBook;
    const maxToday = Math.max(1, ...reading.week.map((d) => d.seconds));

    return (
        <div
            ref={wrapRef}
            className="rd-island"
            data-open={open}
            data-away={away}
            style={style}
            role="region"
            aria-label="Reader controls"
            onKeyDown={(e) => {
                if (e.key === 'Escape' && open) {
                    e.stopPropagation();
                    setOpen(false);
                }
            }}
        >
            <LiquidGlass
                width="100%"
                height={h + 16}
                radius={28}
                blur={4}
                style={{ transition: 'height .45s cubic-bezier(.32,1.2,.4,1), opacity .26s ease-out' }}
            >
                <div ref={innerRef} className="rd-island-inner">
                    <div className="rd-ihead">
                        <div className="rd-grip" role="separator" aria-label="Drag the controls" title="Drag to move" {...grip}>
                            <GripIcon />
                        </div>
                        <button type="button" className="rd-ibrand" onClick={goHome} aria-label={`${BRAND_NAME}: go to the home page`} title="Home">
                            {BRAND_NAME}
                        </button>
                        <button type="button" className="rd-itoggle" aria-expanded={open} aria-label={open ? 'Fold the controls' : 'Open the controls'} onClick={() => setOpen((o) => !o)}>
                            {/* the clock gave its place to "Pacewise" so the bar stays simple and the ▾ always fits */}
                            <span className="rd-read" title="Time spent reading today">
                                <i className="rd-dot" data-on={reading.counting} aria-hidden="true" />
                                <span className="rd-read-label">Today </span>
                                {formatDuration(reading.today)}
                            </span>
                            {p.hasBook && p.pageLabel && (
                                <span className="rd-chip">
                                    {p.pageLabel}
                                    {/^\d+$/.test(p.pageLabel) ? ` / ${p.pageTotal}` : ''}
                                </span>
                            )}
                            <span className="rd-chev" data-open={open}>
                                <Icon d={PATH.chevron} size={18} />
                            </span>
                        </button>
                    </div>

                    {open && (
                        <div className="rd-ibody">
                            <div className="rd-irow" role="group" aria-label="Pages">
                                <span className="rd-lw">
                                    <button className="rd-btn" onClick={p.onPrev} disabled={off} aria-label="Previous page" title="Previous (←)">
                                        <Icon d={PATH.prev} />
                                    </button>
                                    <span className="rd-cap">{'Previous'}</span>
                                </span>
                                <PageJump label={p.pageLabel} total={p.pageTotal} onGoto={p.onGoto} disabled={off} />
                                <span className="rd-lw">
                                    <button className="rd-btn" onClick={p.onNext} disabled={off} aria-label="Next page" title="Next (→)">
                                        <Icon d={PATH.next} />
                                    </button>
                                    <span className="rd-cap">{'Next'}</span>
                                </span>
                            </div>

                            <div className="rd-irow" role="group" aria-label="Auto flip">
                                <span className="rd-lw">
                                    <button
                                    className="rd-btn"
                                    data-on={p.playing}
                                    onClick={p.onTogglePlay}
                                    disabled={off}
                                    aria-pressed={p.playing}
                                    aria-label={p.playing ? 'Pause auto flip' : 'Start auto flip'}
                                    title={p.playing ? 'Pause (Space)' : 'Auto flip (Space)'}
                                >
                                        <Icon d={p.playing ? PATH.pause : PATH.play} fill={!p.playing} />
                                    </button>
                                    <span className="rd-cap">{p.playing ? 'Pause' : 'Play'}</span>
                                </span>
                                <input className="rd-range" type="range" min={1} max={1000} step={1} value={p.wpm} onChange={(e) => p.onWpm(Number(e.target.value))} aria-label="Reading speed in words per minute" />
                                <input
                                    className="rd-num"
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={p.wpm}
                                    aria-label="Words per minute"
                                    onChange={(e) => {
                                        if (e.target.value === '') return;
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v)) p.onWpm(clamp(Math.round(v), 1, 1000));
                                    }}
                                />
                                <span className="rd-unit">wpm</span>
                                <span className="rd-est" aria-hidden="true">
                                    {p.playing && p.seconds !== null ? `${p.seconds < 10 ? p.seconds.toFixed(1) : Math.round(p.seconds)}s` : ''}
                                </span>
                            </div>

                            <div className="rd-irow" role="group" aria-label="View">
                                <button className="rd-btn rd-txt" data-on={p.mode === 'auto'} aria-pressed={p.mode === 'auto'} onClick={() => p.onMode('auto')} title="Auto: two pages, or one on a narrow screen">
                                    Auto
                                </button>
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.mode === 'single'} aria-pressed={p.mode === 'single'} onClick={() => p.onMode('single')} aria-label="One page" title="One page">
                                        <Icon d={PATH.one} />
                                    </button>
                                    <span className="rd-cap">{'One page'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.mode === 'double'} aria-pressed={p.mode === 'double'} onClick={() => p.onMode('double')} aria-label="Two pages" title="Two pages">
                                        <Icon d={PATH.two} />
                                    </button>
                                    <span className="rd-cap">{'Two pages'}</span>
                                </span>
                                <span className="rd-sep" aria-hidden="true" />
                                <span className="rd-lw">
                                    <button className="rd-btn" onClick={() => p.onRotate(-1)} disabled={off} aria-label="Rotate left 90 degrees" title="Rotate left 90°">
                                        <Icon d={PATH.rotL} />
                                    </button>
                                    <span className="rd-cap">{'Rotate left'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" onClick={() => p.onRotate(1)} disabled={off} aria-label="Rotate right 90 degrees" title="Rotate right 90°">
                                        <Icon d={PATH.rotR} />
                                    </button>
                                    <span className="rd-cap">{'Rotate right'}</span>
                                </span>
                            </div>

                            <div className="rd-irow" role="group" aria-label="Tools">
                                <span className="rd-lw">
                                    <button className="rd-btn rd-accent" data-on={p.searchOpen} aria-pressed={p.searchOpen} onClick={p.onSearch} disabled={off} aria-label="Search in book" title="Search in book (Ctrl/Cmd+F or /)">
                                        <Icon d={PATH.search} />
                                    </button>
                                    <span className="rd-cap">{'Search'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.pagesOpen} aria-pressed={p.pagesOpen} onClick={p.onPages} disabled={!p.canEditPages} aria-label="Pages: add, remove, edit, download PDF" title={p.canEditPages ? 'Pages: add, remove, edit, download PDF (P)' : 'Pages can be managed for image and PDF books'}>
                                        <Icon d={PATH.pages} />
                                    </button>
                                    <span className="rd-cap">{'Pages'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" onClick={p.onEditCover} disabled={off} aria-label="Edit covers" title="Edit front and back cover (E)">
                                        <Icon d={PATH.edit} />
                                    </button>
                                    <span className="rd-cap">{'Covers'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.zoomed} aria-pressed={p.zoomed} onClick={p.onZoom} aria-label={p.zoomed ? 'Exit full screen' : 'Full screen'} title={p.zoomed ? 'Exit full screen (F)' : 'Full screen (F)'}>
                                        <Icon d={p.zoomed ? PATH.shrink : PATH.expand} />
                                    </button>
                                    <span className="rd-cap">{p.zoomed ? 'Exit full' : 'Full screen'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" onClick={p.onZoomOut} disabled={p.zoomScale <= 1.01} aria-label="Zoom out" title="Zoom out">
                                        <Icon d={PATH.zout} />
                                    </button>
                                    <span className="rd-cap">{'Zoom out'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" onClick={p.onZoomIn} disabled={p.zoomScale >= 3.99} aria-label="Zoom in" title="Zoom in">
                                        <Icon d={PATH.zin} />
                                    </button>
                                    <span className="rd-cap">{'Zoom in'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" onClick={p.onOpen} aria-label="Open files" title="Open files (images, PDF, EPUB, TXT)">
                                        <Icon d={PATH.open} />
                                    </button>
                                    <span className="rd-cap">{'Open'}</span>
                                </span>
                            </div>

                            <div className="rd-irow" role="group" aria-label="Display">
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.theme === 'day'} aria-pressed={p.theme === 'day'} onClick={() => p.onTheme('day')} aria-label="Day mode" title="Day mode">
                                        <Icon d={PATH.sun} />
                                    </button>
                                    <span className="rd-cap">{'Day'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.theme === 'night'} aria-pressed={p.theme === 'night'} onClick={() => p.onTheme('night')} aria-label="Night mode" title="Night mode">
                                        <Icon d={PATH.moon} />
                                    </button>
                                    <span className="rd-cap">{'Night'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.theme === 'auto'} aria-pressed={p.theme === 'auto'} onClick={() => p.onTheme('auto')} aria-label="Match the system (day or night)" title="Follow the system">
                                        <Icon d={PATH.auto} />
                                    </button>
                                    <span className="rd-cap">{'System'}</span>
                                </span>
                                <span className="rd-sep" aria-hidden="true" />
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.comfortActive} aria-pressed={p.comfort} onClick={() => p.onComfort(!p.comfort)} aria-label="Eye comfort" title="Eye comfort: a warm, low-blue-light screen">
                                        <Icon d={PATH.eye} />
                                    </button>
                                    <span className="rd-cap">{'Eye comfort'}</span>
                                </span>
                                <span className="rd-lw">
                                    <button className="rd-btn" data-on={p.flipBlur} aria-pressed={p.flipBlur} onClick={() => p.onFlipBlur(!p.flipBlur)} aria-label="Blur while turning pages" title={p.flipBlur ? 'Page-turn blur is on. Tap to turn it off.' : 'Page-turn blur is off. Tap to turn it on.'}>
                                        <Icon d={PATH.blur} />
                                    </button>
                                    <span className="rd-cap">{'Flip blur'}</span>
                                </span>
                                {p.night && (
                                    <span className="rd-lw">
                                        <button className="rd-btn" data-on={p.invertPages} aria-pressed={p.invertPages} onClick={() => p.onInvertPages(!p.invertPages)} aria-label="Invert PDF pages at night" title="Invert PDF pages at night">
                                            <Icon d={PATH.drop} />
                                        </button>
                                        <span className="rd-cap">{'Invert PDF'}</span>
                                    </span>
                                )}
                            </div>

                            {(p.comfort || p.comfortAuto) && (
                                <div className="rd-irow" role="group" aria-label="Eye comfort settings">
                                    <div className="rd-warm">
                                        <span className="rd-unit">Warmth</span>
                                        <input className="rd-range" type="range" min={0} max={100} step={1} value={p.comfortLevel} onChange={(e) => p.onComfortLevel(Number(e.target.value))} aria-label="Eye comfort strength" />
                                        <span className="rd-est" aria-hidden="true">{p.comfortLevel}%</span>
                                    </div>
                                    <button className="rd-btn rd-txt" data-on={p.comfortAuto} aria-pressed={p.comfortAuto} onClick={() => p.onComfortAuto(!p.comfortAuto)} title="Switch eye comfort on automatically from 7 pm to 7 am">
                                        Auto 7pm–7am
                                    </button>
                                </div>
                            )}
                            {!p.comfort && !p.comfortAuto && (
                                <div className="rd-irow">
                                    <button className="rd-btn rd-txt" onClick={() => p.onComfortAuto(true)} title="Switch eye comfort on automatically from 7 pm to 7 am">
                                        Eye comfort: auto at night
                                    </button>
                                </div>
                            )}

                            {/* the week's reading (the same numbers as Analytics); a tap opens the Analytics dashboard */}
                            <div
                                className="rd-iweek pe-week-link"
                                role="link"
                                tabIndex={0}
                                title="Open Analytics"
                                onClick={() => router.push('/analytics')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        router.push('/analytics');
                                    }
                                }}
                                aria-label={`Reading time over the last 7 days. Today ${formatDuration(reading.today)}. Open Analytics.`}
                            >
                                {reading.week.map((d) => (
                                    <div key={d.key} className="rd-bar-col" data-today={d.today} title={`${d.key}: ${formatDuration(d.seconds)}`}>
                                        <span className="rd-bar-fill2" style={{ height: `${Math.max(d.seconds > 0 ? 8 : 3, (d.seconds / maxToday) * 100)}%` }} />
                                        <small>{d.label}</small>
                                    </div>
                                ))}
                            </div>

                            <button className="rd-btn rd-hidebtn" onClick={p.onHide} aria-label="Hide controls" title="Hide controls (H)">
                                <Icon d={PATH.hide} size={18} />
                                <span>Hide controls</span>
                            </button>
                        </div>
                    )}
                </div>
            </LiquidGlass>
        </div>
    );
}

/** The thin bar along the bottom edge while the controls are hidden. It also shows reading progress. */
export function ShowBar({ hidden, progress, onShow }: { hidden: boolean; progress: number; onShow: () => void }) {
    return (
        <button className="rd-bar" data-visible={hidden} onClick={onShow} aria-label="Show controls" title="Show controls (H)" tabIndex={hidden ? 0 : -1}>
            <span className="rd-bar-track">
                <span className="rd-bar-fill" style={{ width: `${clamp(progress, 0, 1) * 100}%` }} />
            </span>
        </button>
    );
}
