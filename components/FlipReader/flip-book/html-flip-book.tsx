'use client';

import React, {
    CSSProperties,
    useEffect,
    useContext,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    DEFAULT_SETTINGS,
    FlipBookApi,
    FlipBookHandle,
    FlipEventName,
    FlipOptions,
    IEventProps,
    IFlipEvent,
    IFlipSetting,
    PageOrientation,
    PageState,
} from './settings';

/* ------------------------------------------------------------------ *
 *  Types
 * ------------------------------------------------------------------ */

interface IProps extends Partial<IFlipSetting>, IEventProps {
    className?: string;
    style?: CSSProperties;
    children?: React.ReactNode;
}

interface Layout {
    W: number; // page width
    H: number; // page height
    portrait: boolean;
    n: number; // number of pages
    L: number; // number of leaves (a leaf = sheet of paper with a front and a back)
    offset: number; // 1 when a blank page is prepended (landscape without cover)
    minF: number; // min number of flipped leaves
    maxF: number; // max number of flipped leaves
}

interface Anim {
    from: number;
    to: number;
    start: number;
    dur: number;
    ease: (t: number) => number;
    done?: () => void;
}

interface Drag {
    pointerId: number;
    dir: 1 | -1;
    leaf: number;
    startX: number;
    startCX: number;
    startCY: number;
    a0: number;
    active: boolean;
    /** pressed while another flip was running: can be a tap or hold, but never a drag */
    tapOnly: boolean;
    /** the press turned into a hold (fast flip) */
    held: boolean;
    lastCX: number;
    lastT: number;
    v: number;
}

type Listener = (e: IFlipEvent<any>) => void;

interface State {
    settings: IFlipSetting;
    layout: Layout;
    props: IEventProps;

    f: number; // number of flipped leaves (logical position)
    page: number; // last settled page index
    angles: number[]; // 0 = lying on the right, 180 = lying on the left
    anims: Map<number, Anim>;
    raf: number;
    busy: boolean;
    drag: Drag | null;
    queued: { f: number; duration?: number } | null;
    pointers: Set<number>;
    multiAt: number;
    holdTimer: ReturnType<typeof setTimeout> | null;
    holding: { pointerId: number; dir: 1 | -1 } | null;
    peek: { leaf: number; to: number } | null;
    state: PageState;
    orientation: PageOrientation | null;
    listeners: Partial<Record<FlipEventName, Set<Listener>>>;

    stageEl: HTMLDivElement | null;
    leafEls: (HTMLDivElement | null)[];
    frontShade: (HTMLDivElement | null)[];
    backShade: (HTMLDivElement | null)[];
    /** the page content inside each face (this is what gets blurred) */
    frontInner: (HTMLDivElement | null)[];
    backInner: (HTMLDivElement | null)[];
    /** per leaf: speed tracking for motion blur, and what was last written to the DOM */
    motion: { a: number; t: number; blur: number; dir: number }[];
    written: { z?: string; tf?: string; vis?: string; disp?: string; fo?: string; bo?: string; fb?: number; bb?: number }[];
    lastFrame: number;
    /** running average of the frame time while pages move, and how many frames it is based on */
    ema: number;
    frames: number;
    applyRaf: number;
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const HANDLERS = {
    flip: 'onFlip',
    changeOrientation: 'onChangeOrientation',
    changeState: 'onChangeState',
    init: 'onInit',
    update: 'onUpdate',
} as const;

/** Pages can read the size (px) the book gives them, e.g. to render a canvas at the right resolution. */
const FlipPageSizeContext = React.createContext<{ W: number; H: number }>({ W: 360, H: 480 });
export const useFlipPageSize = () => useContext(FlipPageSizeContext);

const PEEK = 9; // degrees a page lifts when hovering a corner
const HOLD_DELAY = 420; // ms a still press must last to count as a hold
const HOLD_SLOP = 8; // px a pointer may wander during a hold

/* ------------------------------------------------------------------ *
 *  Small helpers
 * ------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const clamp01 = (v: number) => clamp(v, 0, 1);
const sinDeg = (d: number) => Math.sin((d * Math.PI) / 180);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** CSS-style cubic-bezier(x1, y1, x2, y2) easing. */
function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
    const sy = (t: number) => ((ay * t + by) * t + cy) * t;
    const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let t = x;
        for (let i = 0; i < 8; i++) {
            const e = sx(t) - x;
            if (Math.abs(e) < 1e-5) return sy(t);
            const d = dx(t);
            if (Math.abs(d) < 1e-6) break;
            t -= e / d;
        }
        let lo = 0;
        let hi = 1;
        t = x;
        for (let i = 0; i < 24; i++) {
            const e = sx(t) - x;
            if (Math.abs(e) < 1e-5) break;
            if (e > 0) hi = t;
            else lo = t;
            t = (lo + hi) / 2;
        }
        return sy(t);
    };
}

/** A page turn: a gentle start, a quick middle and a long soft landing, like paper that settles. */
const EASE_FLIP = bezier(0.42, 0, 0.18, 1);
/** After the finger lets go the page keeps its speed and then eases out, so there is no stop-start. */
const EASE_RELEASE = bezier(0.16, 0.64, 0.22, 1);

/* motion blur (see IFlipSetting.motionBlur) */
const MAX_BLUR = 30; // px, for the page that is moving
const BLUR_PER_DEG_MS = 40; // px of blur for every degree per millisecond of page speed
const UNDER_BLUR = 14; // px, for the page the turning one passes over
const SLOW_FRAME_MS = 50; // an average frame slower than this (about 20 fps) over 12+ frames means the device cannot keep up
let adaptiveBlurOff = false; // set when this device cannot keep up: blur then stays off until the page is reloaded

const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[data-no-flip]';

function computeSize(avail: number, s: IFlipSetting) {
    const ratio = s.height / s.width;

    let portrait: boolean;
    if (s.layoutMode === 'single') portrait = true;
    else if (s.layoutMode === 'double') portrait = false;
    else if (!s.usePortrait || avail <= 0) portrait = false;
    else portrait = s.size === 'stretch' ? avail / 2 < s.minWidth : avail < 2 * s.width;

    if (s.size === 'stretch' && avail > 0) {
        // fit one page slot (half the width for a spread), then shrink to the available height
        const slot = portrait ? avail : avail / 2;
        let pw = Math.min(slot, s.maxWidth);
        let ph = pw * ratio;
        if (ph > s.maxHeight) {
            ph = s.maxHeight;
            pw = ph / ratio;
        }
        return { portrait, W: Math.max(1, Math.round(pw)), H: Math.max(1, Math.round(ph)) };
    }

    return { portrait, W: s.width, H: s.height };
}

/* ------------------------------------------------------------------ *
 *  The engine: all imperative logic lives here, reading from `S` only,
 *  so timers and event handlers never see stale React closures.
 * ------------------------------------------------------------------ */

function createEngine(S: State) {
    /* ---------- page <-> leaf mapping ---------- */

    const fToPage = (f: number) => {
        const { portrait, offset, n } = S.layout;
        if (portrait) return clamp(f, 0, Math.max(0, n - 1));
        const left = 2 * f - 1 - offset;
        const right = 2 * f - offset;
        return clamp(left >= 0 ? left : right, 0, Math.max(0, n - 1));
    };

    const pageToF = (page: number) => {
        const { portrait, offset, minF, maxF, n } = S.layout;
        const p = clamp(Math.round(page), 0, Math.max(0, n - 1));
        const f = portrait ? p : Math.ceil((p + offset) / 2);
        return Math.min(Math.max(f, minF), maxF);
    };

    /* ---------- events ---------- */

    const emit = (type: FlipEventName, data: unknown) => {
        const ev: IFlipEvent<any> = { data, object: api };
        const handler = S.props[HANDLERS[type]] as unknown as Listener | undefined;
        handler?.(ev);
        S.listeners[type]?.forEach((cb) => cb(ev));
    };

    const setState = (s: PageState) => {
        if (S.state !== s) {
            S.state = s;
            emit('changeState', s);
        }
    };

    const finishFlip = () => {
        S.page = fToPage(S.f);
        setState('read');
        emit('flip', S.page);
    };

    /* ---------- rendering the current angles into the DOM ---------- */

    const apply = () => {
        const { W, L, portrait, minF, maxF } = S.layout;
        const st = S.settings;
        const ang = S.angles;
        const M = clamp01(st.maxShadowOpacity);
        const now = performance.now();
        const blurOn = st.motionBlur > 0 && !adaptiveBlurOff;

        // how fast is each leaf turning? (degrees per millisecond, smoothed)
        for (let i = 0; i < L; i++) {
            const a = ang[i] ?? 0;
            let m = S.motion[i];
            if (!m) m = S.motion[i] = { a, t: now, blur: 0, dir: 0 };
            const dt = now - m.t;
            if (dt >= 4) {
                // a turning page is always softly blurred (most in the middle of the turn), and faster turns blur more,
                // so a flip melts from one page to the next instead of snapping
                const moving = a > 0.05 && a < 179.95;
                const soft = moving ? MAX_BLUR * 0.55 * sinDeg(a) : 0;
                const fast = (Math.abs(a - m.a) / dt) * BLUR_PER_DEG_MS;
                const target = blurOn ? Math.min(MAX_BLUR, Math.max(soft, fast)) * st.motionBlur : 0;
                m.blur += (target - m.blur) * (moving ? 0.14 : 0.4); // eases in while turning, clears quickly once the page lands
                if (m.blur < 0.1) m.blur = 0;
                if (Math.abs(a - m.a) > 0.01) m.dir = a > m.a ? 1 : -1;
                m.a = a;
                m.t = now;
            }
        }

        const q = (b: number) => (b < 0.1 ? 0 : Math.round(b * 10) / 10); // blur in steps of 0.1 px, so it changes smoothly
        const setBlur = (el: HTMLDivElement | null, px: number) => {
            if (!el) return;
            el.style.filter = px > 0 ? `blur(${px}px)` : '';
            el.style.willChange = px > 0 ? 'filter' : '';
        };

        for (let i = 0; i < L; i++) {
            const el = S.leafEls[i];
            if (!el) continue;
            const w = S.written[i] || (S.written[i] = {});

            const visible = (i >= S.f - 3 && i <= S.f + 3) || S.anims.has(i);
            const disp = visible ? 'block' : 'none';
            if (w.disp !== disp) {
                el.style.display = disp;
                w.disp = disp;
            }
            if (!visible) continue;

            const a = ang[i] ?? 0;
            const moving = a > 0.05 && a < 179.95;

            const tf = `rotateY(${-a}deg)`;
            if (w.tf !== tf) {
                el.style.transform = tf;
                w.tf = tf;
            }
            const vis = portrait && a >= 179.95 ? 'hidden' : 'visible';
            if (w.vis !== vis) {
                el.style.visibility = vis;
                w.vis = vis;
            }
            // a moving leaf sits above everything; stacks grow toward the spine
            const z = String(st.startZIndex + (moving ? L + 10 : a >= 90 ? i + 1 : L - i));
            if (w.z !== z) {
                el.style.zIndex = z;
                w.z = z;
            }

            const fs = S.frontShade[i];
            const bs = S.backShade[i];
            let fo = 0;
            let bo = 0;
            if (st.drawShadow && fs && bs) {
                // the leaf darkens as it turns away from / toward the viewer
                if (a <= 90) fo += M * 0.55 * (a / 90);
                else bo += M * 0.55 * ((180 - a) / 90);
                // shadow cast by the neighbouring leaf that is passing over
                fo += M * 0.5 * sinDeg(i > 0 ? ang[i - 1] : 0);
                bo += M * 0.5 * sinDeg(i < L - 1 ? ang[i + 1] : 0);
                const fos = String(Math.round(Math.min(0.9, fo) * 200) / 200);
                const bos = String(Math.round(Math.min(0.9, bo) * 200) / 200);
                if (w.fo !== fos) {
                    fs.style.opacity = fos;
                    w.fo = fos;
                }
                if (w.bo !== bos) {
                    bs.style.opacity = bos;
                    w.bo = bos;
                }
            }

            // motion blur: the turning page blurs with its speed, the page it passes over softens a little
            const own = q(S.motion[i]?.blur ?? 0);
            // the page the turning one lands on (the side it turns toward) softens a little; the opposite side stays sharp
            const prevM = i > 0 ? S.motion[i - 1] : undefined;
            const nextM = i < L - 1 ? S.motion[i + 1] : undefined;
            const underFront = blurOn && prevM && prevM.dir < 0 ? q(UNDER_BLUR * st.motionBlur * sinDeg(ang[i - 1])) : 0;
            const underBack = blurOn && nextM && nextM.dir > 0 ? q(UNDER_BLUR * st.motionBlur * sinDeg(ang[i + 1])) : 0;
            const fb = Math.max(own, underFront);
            const bb = Math.max(own, underBack);
            if (w.fb !== fb) {
                setBlur(S.frontInner[i], fb);
                w.fb = fb;
            }
            if (w.bb !== bb) {
                setBlur(S.backInner[i], bb);
                w.bb = bb;
            }
        }

        // once the pages have landed, keep drawing until every leftover blur has faded out: both pages end perfectly clear
        if (S.anims.size === 0 && S.motion.some((m) => m && m.blur > 0)) scheduleApply();

        // keep a closed cover centred
        let shift = 0;
        if (!portrait && st.showCover && L > 0) {
            if (minF === 0) shift -= (W / 2) * (1 - clamp01(ang[0] / 180));
            if (maxF === L) shift += (W / 2) * clamp01(ang[L - 1] / 180);
        }
        if (S.stageEl) S.stageEl.style.transform = `translateX(${shift}px)`;
    };

    /** Several pointer events can arrive in one frame (high refresh rate screens): draw once per frame. */
    const scheduleApply = () => {
        if (S.applyRaf) return;
        S.applyRaf = requestAnimationFrame(() => {
            S.applyRaf = 0;
            apply();
        });
    };

    /* ---------- animation ---------- */

    const tick = (now: number) => {
        S.raf = 0;
        // a device that cannot keep about 20 fps while pages move gets no blur (it costs a little on every frame)
        if (S.lastFrame) {
            const dt = now - S.lastFrame;
            S.ema = S.ema ? S.ema * 0.85 + dt * 0.15 : dt;
            S.frames++;
            const keep = typeof window !== 'undefined' && (window as unknown as { __flipKeepBlur?: boolean }).__flipKeepBlur;
            if (S.frames >= 12 && S.ema > SLOW_FRAME_MS && !keep) adaptiveBlurOff = true;
        }
        S.lastFrame = now;
        const finished: Anim[] = [];
        S.anims.forEach((a, i) => {
            const t = clamp01((now - a.start) / a.dur);
            S.angles[i] = a.from + (a.to - a.from) * a.ease(t);
            if (t >= 1) {
                S.anims.delete(i);
                finished.push(a);
            }
        });
        apply();
        finished.forEach((a) => a.done?.());
        if (S.anims.size > 0 && !S.raf) S.raf = requestAnimationFrame(tick);
        else if (S.anims.size === 0) S.lastFrame = 0; // the pause between two flips is not a slow frame; the average carries on
    };

    const animateTo = (leaf: number, to: number, dur: number, done?: () => void, easing: (t: number) => number = EASE_FLIP) => {
        S.anims.set(leaf, {
            from: S.angles[leaf] ?? 0,
            to,
            start: performance.now(),
            dur: Math.max(1, dur),
            ease: easing,
            done,
        });
        if (!S.raf) S.raf = requestAnimationFrame(tick);
    };

    const baseAngle = (leaf: number) => (leaf < S.f ? 180 : 0);

    /* ---------- flipping ---------- */

    const flipStep = (dir: 1 | -1, steps = 1, duration?: number): boolean => {
        const { minF, maxF } = S.layout;
        if (S.busy || S.drag?.active) return false;

        const target = clamp(S.f + dir * steps, minF, maxF);
        const count = Math.abs(target - S.f);
        if (count === 0) return false;

        const ang = S.angles;
        let leaf: number;
        if (dir === 1) {
            for (let i = S.f; i < S.f + count - 1; i++) ang[i] = 180;
            leaf = S.f + count - 1;
        } else {
            for (let i = S.f - count; i < S.f - 1; i++) ang[i] = 0;
            leaf = S.f - 1;
        }

        // drop a corner peek that is on a different leaf
        if (S.peek && S.peek.leaf !== leaf) {
            S.anims.delete(S.peek.leaf);
            ang[S.peek.leaf] = baseAngle(S.peek.leaf);
        }
        S.peek = null;

        S.busy = true;
        setState('flipping');
        S.f = target;

        const to = dir === 1 ? 180 : 0;
        const frac = Math.abs(to - ang[leaf]) / 180;
        animateTo(leaf, to, duration ?? S.settings.flippingTime * Math.max(0.25, frac), () => {
            S.busy = false;
            finishFlip();
            runQueued();
        });
        return true;
    };

    /** Runs the flip that was requested while another one was in progress (latest request wins). */
    const runQueued = () => {
        const q = S.queued;
        S.queued = null;
        if (!q || q.f === S.f) return;
        if (!flipStep(q.f > S.f ? 1 : -1, Math.abs(q.f - S.f), q.duration) && S.drag?.active) S.queued = q;
    };

    const turnToF = (f: number) => {
        const { minF, maxF, L } = S.layout;
        const target = clamp(f, minF, maxF);
        S.anims.clear();
        S.queued = null;
        S.peek = null;
        S.busy = false;
        S.angles = Array.from({ length: L }, (_, i) => (i < target ? 180 : 0));
        S.f = target;
        apply();
        const p = fToPage(target);
        if (p !== S.page) {
            S.page = p;
            emit('flip', p);
        }
        setState('read');
    };

    /* ---------- public API ---------- */

    const api: FlipBookApi = {
        flipNext: (opts?: FlipOptions) => flipStep(1, 1, opts?.duration),
        flipPrev: (opts?: FlipOptions) => flipStep(-1, 1, opts?.duration),
        flip: (page, opts?: FlipOptions) => {
            const t = pageToF(page);
            if (S.busy || S.drag?.active) {
                S.queued = { f: t, duration: opts?.duration };
                return;
            }
            if (t !== S.f) flipStep(t > S.f ? 1 : -1, Math.abs(t - S.f), opts?.duration);
        },
        turnToPage: (page) => turnToF(pageToF(page)),
        turnToNextPage: () => turnToF(S.f + 1),
        turnToPrevPage: () => turnToF(S.f - 1),
        getCurrentPageIndex: () => fToPage(S.f),
        getVisiblePages: () => {
            const { portrait, offset, n } = S.layout;
            if (portrait) return n ? [fToPage(S.f)] : [];
            return [2 * S.f - 1 - offset, 2 * S.f - offset].filter((p) => p >= 0 && p < n);
        },
        getPageCount: () => S.layout.n,
        getOrientation: () => (S.layout.portrait ? 'portrait' : 'landscape'),
        getState: () => S.state,
        on: (event, cb) => {
            (S.listeners[event] ||= new Set()).add(cb);
            return api;
        },
        off: (event, cb) => {
            if (!cb) S.listeners[event]?.clear();
            else S.listeners[event]?.delete(cb);
            return api;
        },
    };

    /* ---------- structure changes (orientation, page count, cover) ---------- */

    const reinit = () => {
        const { L, minF, maxF } = S.layout;
        if (S.raf) cancelAnimationFrame(S.raf);
        S.raf = 0;
        S.anims.clear();
        S.queued = null;
        S.peek = null;
        S.drag = null;
        S.pointers.clear();
        if (S.holdTimer) clearTimeout(S.holdTimer);
        S.holdTimer = null;
        S.holding = null;
        S.busy = false;
        S.f = Math.min(Math.max(pageToF(S.page), minF), maxF);
        S.angles = Array.from({ length: L }, (_, i) => (i < S.f ? 180 : 0));
        S.page = fToPage(S.f);
        apply();
    };

    /* ---------- pointer input ---------- */

    const rel = (e: React.PointerEvent) => {
        // Map the pointer into the book's own coordinates (origin: spine, or the left edge in
        // single-page mode), undoing any rotation the parent applied with CSS.
        const rect = S.stageEl!.getBoundingClientRect();
        const { W, H, portrait } = S.layout;
        const t = (((S.settings.rotation % 360) + 360) % 360) * (Math.PI / 180);
        const z = S.settings.zoom || 1;
        const dx = (e.clientX - (rect.left + rect.width / 2)) / z;
        const dy = (e.clientY - (rect.top + rect.height / 2)) / z;
        const lx = dx * Math.cos(t) + dy * Math.sin(t);
        const ly = -dx * Math.sin(t) + dy * Math.cos(t);
        return { x: lx + (portrait ? W / 2 : 0), y: ly + H / 2 };
    };

    const inCorner = (x: number, y: number) => {
        const { W, H, portrait } = S.layout;
        const vertical = y < H * 0.2 || y > H * 0.8;
        const outer = portrait ? x > W * 0.78 : Math.abs(x) > W * 0.78;
        return vertical && outer;
    };

    const updatePeek = (x: number, y: number) => {
        const { W, H, portrait, minF, maxF } = S.layout;
        let t: { leaf: number; to: number } | null = null;

        if (S.settings.showPageCorners && S.settings.zoom <= 1.01 && (y < H * 0.2 || y > H * 0.8)) {
            if (x > W * 0.78 && x <= W && S.f < maxF) t = { leaf: S.f, to: PEEK };
            else if (!portrait && x < -W * 0.78 && x >= -W && S.f > minF)
                t = { leaf: S.f - 1, to: 180 - PEEK };
        }

        const cur = S.peek;
        if ((cur && t && cur.leaf === t.leaf) || (!cur && !t)) return;

        if (cur) {
            S.peek = null;
            animateTo(cur.leaf, baseAngle(cur.leaf), 220, undefined, easeInOutCubic);
        }
        if (t) {
            S.peek = t;
            animateTo(t.leaf, t.to, 220, undefined, easeInOutCubic);
            setState('fold_corner');
        } else {
            setState('read');
        }
    };

    const settle = (leaf: number, dir: 1 | -1, commit: boolean, flick = 0) => {
        S.busy = true;
        setState('flipping');
        const to = commit ? (dir === 1 ? 180 : 0) : dir === 1 ? 0 : 180;
        const frac = Math.abs(to - S.angles[leaf]) / 180;
        if (commit) S.f += dir;
        // a quick flick lands sooner; a slow drag takes its time
        const speedUp = 1 / (1 + Math.min(1.5, Math.max(0, flick)) * 0.6);
        animateTo(
            leaf,
            to,
            S.settings.flippingTime * Math.max(0.2, frac) * speedUp,
            () => {
                S.busy = false;
                if (commit) finishFlip();
                else setState('read');
                runQueued();
            },
            EASE_RELEASE
        );
    };

    const clearHoldTimer = () => {
        if (S.holdTimer) clearTimeout(S.holdTimer);
        S.holdTimer = null;
    };

    const endHold = () => {
        const h = S.holding;
        if (!h) return;
        S.holding = null;
        S.props.onHold?.({ data: { dir: h.dir, phase: 'end' }, object: api });
    };

    const startHold = () => {
        S.holdTimer = null;
        const d = S.drag;
        if (!d || d.active || d.held || S.pointers.size > 1 || S.settings.zoom > 1.01 || !S.props.onHold) return;
        d.held = true;
        try {
            S.stageEl?.setPointerCapture(d.pointerId);
        } catch {
            /* ignore */
        }
        S.holding = { pointerId: d.pointerId, dir: d.dir };
        S.props.onHold({ data: { dir: d.dir, phase: 'start' }, object: api });
    };

    /** A second finger arrived (pinch) or the gesture was interrupted: drop whatever was in progress. */
    const cancelGesture = () => {
        clearHoldTimer();
        endHold();
        const d = S.drag;
        S.drag = null;
        if (d?.active) {
            try {
                S.stageEl?.releasePointerCapture(d.pointerId);
            } catch {
                /* ignore */
            }
            settle(d.leaf, d.dir, false);
        }
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const st = S.settings;
        const { W, portrait, minF, maxF } = S.layout;

        S.pointers.add(e.pointerId);
        if (S.pointers.size > 1) {
            S.multiAt = performance.now(); // pinch: never a tap, drag or hold
            cancelGesture();
            return;
        }

        if (!st.useMouseEvents || !S.stageEl) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (st.clickEventForward && (e.target as HTMLElement).closest(INTERACTIVE)) return;

        const { x, y } = rel(e);
        if (st.disableFlipByClick && !inCorner(x, y)) return;

        const dir: 1 | -1 = (portrait ? x > W / 2 : x > 0) ? 1 : -1;
        if (dir === 1 && S.f >= maxF) return;
        if (dir === -1 && S.f <= minF) return;

        const leaf = dir === 1 ? S.f : S.f - 1;
        S.drag = {
            pointerId: e.pointerId,
            dir,
            leaf,
            startX: x,
            startCX: e.clientX,
            startCY: e.clientY,
            a0: S.angles[leaf],
            active: false,
            tapOnly: S.busy || !!S.drag?.active,
            held: false,
            lastCX: e.clientX,
            lastT: performance.now(),
            v: 0,
        };
        clearHoldTimer();
        S.holdTimer = setTimeout(startHold, HOLD_DELAY);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!S.stageEl) return;
        const d = S.drag;

        if (!d || d.pointerId !== e.pointerId) {
            if (e.pointerType === 'mouse' && e.buttons === 0 && !S.busy && !S.drag) {
                const { x, y } = rel(e);
                updatePeek(x, y);
            }
            return;
        }

        if (d.held) return; // a fast flip is running; wiggling must not turn it into a drag

        if (!d.active) {
            const moved = Math.hypot(e.clientX - d.startCX, e.clientY - d.startCY);
            if (moved > HOLD_SLOP) clearHoldTimer(); // moving: this is not a hold
            if (moved < 5) return;
            if (d.tapOnly || S.settings.zoom > 1.01) return; // no dragging during a flip, or while zoomed in
            d.active = true;
            clearHoldTimer();
            d.a0 = S.angles[d.leaf];
            S.anims.delete(d.leaf);
            S.peek = null;
            try {
                S.stageEl.setPointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            setState('user_fold');
        }

        const { W, portrait } = S.layout;
        const { x } = rel(e);

        let prog: number;
        if (d.dir === 1) {
            const far = portrait ? 0 : -W;
            prog = clamp01((d.startX - x) / Math.max(30, d.startX - far));
        } else {
            const far = W;
            prog = clamp01((x - d.startX) / Math.max(30, far - d.startX));
        }
        const end = d.dir === 1 ? 180 : 0;
        S.angles[d.leaf] = d.a0 + (end - d.a0) * prog;

        // smoothed velocity along the flip direction (px/ms)
        const now = performance.now();
        const dt = Math.max(1, now - d.lastT);
        const inst = ((e.clientX - d.lastCX) / dt) * (d.dir === 1 ? -1 : 1);
        d.v = d.v * 0.7 + inst * 0.3;
        d.lastCX = e.clientX;
        d.lastT = now;

        scheduleApply();
    };

    const endPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
        S.pointers.delete(e.pointerId);
        const d = S.drag;
        if (!d || d.pointerId !== e.pointerId) return;
        S.drag = null;
        clearHoldTimer();

        if (d.held) {
            // the fast flip ends the moment the finger / button is released
            endHold();
            try {
                S.stageEl?.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            return;
        }

        if (d.active) {
            try {
                S.stageEl?.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            const a = S.angles[d.leaf];
            const distance = Math.abs(e.clientX - d.startCX);
            const flick = d.v > 0.35 && distance >= S.settings.swipeDistance;
            const commit = cancelled
                ? false
                : d.dir === 1
                ? a > 90 || (flick && a > 15)
                : a < 90 || (flick && a < 165);
            settle(d.leaf, d.dir, commit, d.v);
        } else if (!cancelled) {
            // a plain tap
            if (Math.hypot(e.clientX - d.startCX, e.clientY - d.startCY) > 10) return;
            if (performance.now() - S.multiAt < 350) return; // lifting a finger after a pinch is not a tap
            const handled = S.props.onTap?.({ data: { dir: d.dir, pointerType: e.pointerType }, object: api });
            if (handled !== true && !flipStep(d.dir) && S.busy) {
                // another flip is still running: remember this tap and run it right after
                const from = S.queued ? S.queued.f : S.f;
                S.queued = { f: clamp(from + d.dir, S.layout.minF, S.layout.maxF) };
            }
        }
    };

    const onPointerLeave = () => {
        if (S.drag?.active || S.busy) return;
        updatePeek(NaN, NaN);
    };

    const destroy = () => {
        if (S.raf) cancelAnimationFrame(S.raf);
        S.raf = 0;
        if (S.applyRaf) cancelAnimationFrame(S.applyRaf);
        S.applyRaf = 0;
        clearHoldTimer();
        endHold();
    };

    return {
        api,
        apply,
        reinit,
        emit,
        destroy,
        onPointerDown,
        onPointerMove,
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => endPointer(e, false),
        onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => endPointer(e, true),
        onPointerLeave,
        /**
         * A touch starts with an implicit capture on the element under the finger. When the book takes the pointer
         * (setPointerCapture) that element loses it and the browser sends lostpointercapture, which bubbles up here.
         * Only a capture lost by the book itself ends the gesture; the bubbled one must be ignored.
         */
        onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => {
            if (e.target === S.stageEl) endPointer(e, true);
        },
    };
}

/* ------------------------------------------------------------------ *
 *  Styles for the paper
 * ------------------------------------------------------------------ */

const PAPER = '#fbf8f2';

const overlay: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
};

const faceStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: PAPER,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
};

const SPINE_FRONT = 'linear-gradient(to right, rgba(0,0,0,.26) 0%, rgba(0,0,0,.07) 5%, rgba(0,0,0,0) 14%)';
const SPINE_BACK = 'linear-gradient(to left, rgba(0,0,0,.26) 0%, rgba(0,0,0,.07) 5%, rgba(0,0,0,0) 14%)';
const SHADE_FRONT = 'linear-gradient(to right, rgba(0,0,0,.75), rgba(0,0,0,.28) 60%, rgba(0,0,0,.05))';
const SHADE_BACK = 'linear-gradient(to left, rgba(0,0,0,.75), rgba(0,0,0,.28) 60%, rgba(0,0,0,.05))';

/* ------------------------------------------------------------------ *
 *  The component
 * ------------------------------------------------------------------ */

const HTMLFlipBookForward = React.forwardRef<FlipBookHandle, IProps>((incoming, ref) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [avail, setAvail] = useState(0);

    // merge settings, ignoring props that are explicitly `undefined`
    const settings: IFlipSetting = { ...DEFAULT_SETTINGS };
    (Object.keys(DEFAULT_SETTINGS) as (keyof IFlipSetting)[]).forEach((k) => {
        if (incoming[k] !== undefined) (settings as any)[k] = incoming[k];
    });

    /* ----- derive layout ----- */
    const items = React.Children.toArray(incoming.children);
    const n = items.length;
    const { portrait, W, H } = computeSize(avail, settings);

    const offset = portrait ? 0 : settings.showCover ? 0 : 1;
    let pages: React.ReactNode[];
    let padded = false;
    if (portrait) {
        pages = items;
    } else {
        pages = offset ? [null, ...items] : [...items];
        if (pages.length % 2 === 1) {
            pages.push(null);
            padded = true;
        }
    }
    const L = n === 0 ? 0 : portrait ? n : pages.length / 2;
    const minF = portrait || settings.showCover ? 0 : 1;
    const maxF = portrait ? Math.max(0, n - 1) : Math.max(minF, padded ? L - 1 : L);
    const layout: Layout = { W, H, portrait, n, L, offset, minF, maxF };

    /* ----- engine (created once) ----- */
    const stRef = useRef<State | null>(null);
    const engRef = useRef<ReturnType<typeof createEngine> | null>(null);
    if (!stRef.current) {
        stRef.current = {
            settings,
            layout,
            props: incoming,
            f: 0,
            page: Math.max(0, settings.startPage),
            angles: [],
            anims: new Map(),
            raf: 0,
            busy: false,
            drag: null,
            queued: null,
            pointers: new Set(),
            multiAt: 0,
            holdTimer: null,
            holding: null,
            peek: null,
            state: 'read',
            orientation: null,
            listeners: {},
            stageEl: null,
            leafEls: [],
            frontShade: [],
            backShade: [],
            frontInner: [],
            backInner: [],
            motion: [],
            written: [],
            lastFrame: 0,
            ema: 0,
            frames: 0,
            applyRaf: 0,
        };
        engRef.current = createEngine(stRef.current);
    }
    const S = stRef.current as State;
    const engine = engRef.current!;

    useImperativeHandle(ref, () => ({ pageFlip: () => engine.api }), [engine]);

    /* ----- keep the engine in sync with the latest props ----- */
    useIsoLayoutEffect(() => {
        S.settings = settings;
        S.layout = layout;
        S.props = incoming;
    });

    // structure changed (orientation / page count / cover): rebuild angles from the current page
    const firstRun = useRef(true);
    useIsoLayoutEffect(() => {
        engine.reinit();
        const mode: PageOrientation = portrait ? 'portrait' : 'landscape';
        if (firstRun.current) {
            firstRun.current = false;
            S.orientation = mode;
            engine.emit('init', { page: S.page, mode });
        } else {
            if (S.orientation !== mode) {
                S.orientation = mode;
                engine.emit('changeOrientation', mode);
            }
            engine.emit('update', { page: S.page, mode });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [portrait, L, minF, maxF, offset]);

    // sizes / shadow settings changed: repaint
    useIsoLayoutEffect(() => {
        engine.apply();
    });

    useEffect(() => () => engine.destroy(), [engine]);

    /* ----- measure the parent element ----- */
    useIsoLayoutEffect(() => {
        const parent = rootRef.current?.parentElement;
        if (!parent) return undefined;
        const measure = () => {
            const cs = getComputedStyle(parent);
            const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            setAvail(Math.max(0, parent.clientWidth - pad));
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(measure);
        ro.observe(parent);
        return () => ro.disconnect();
    }, []);

    /* ----- render ----- */
    const bookW = portrait ? W : 2 * W;
    const sizeValue = useMemo(() => ({ W, H }), [W, H]);
    const drawShadow = settings.drawShadow;

    const renderFace = (side: 'front' | 'back', i: number, content: React.ReactNode) => {
        const isFront = side === 'front';
        return (
            <div
                style={{
                    ...faceStyle,
                    background: settings.paperColor,
                    transform: isFront ? undefined : 'rotateY(180deg)',
                }}
            >
                <div
                    ref={(el) => {
                        (isFront ? S.frontInner : S.backInner)[i] = el;
                    }}
                    style={{ width: W, height: H, position: 'relative' }}
                >
                    {content}
                </div>
                {drawShadow && (
                    <>
                        <div style={{ ...overlay, background: isFront ? SPINE_FRONT : SPINE_BACK }} />
                        <div
                            ref={(el) => {
                                (isFront ? S.frontShade : S.backShade)[i] = el;
                            }}
                            style={{
                                ...overlay,
                                background: isFront ? SHADE_FRONT : SHADE_BACK,
                                opacity: 0,
                                willChange: 'opacity', // fading the shade must not repaint the page under it
                            }}
                        />
                    </>
                )}
            </div>
        );
    };

    const leaves: React.ReactNode[] = [];
    for (let i = 0; i < L; i++) {
        const front = portrait ? items[i] : pages[2 * i];
        const back = portrait ? null : pages[2 * i + 1];
        leaves.push(
            <div
                key={i}
                ref={(el) => {
                    S.leafEls[i] = el;
                }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: portrait ? 0 : W,
                    width: W,
                    height: H,
                    transformOrigin: 'left center',
                    transformStyle: 'preserve-3d',
                    willChange: 'transform',
                }}
            >
                {renderFace('front', i, front)}
                {renderFace('back', i, back)}
            </div>
        );
    }
    S.leafEls.length = L;
    S.frontShade.length = L;
    S.backShade.length = L;
    S.frontInner.length = L;
    S.backInner.length = L;

    return (
        <div
            ref={rootRef}
            className={incoming.className}
            style={{
                position: 'relative',
                height: H,
                width: settings.autoSize ? bookW : undefined,
                ...incoming.style,
            }}
        >
            <div
                ref={(el) => {
                    S.stageEl = el;
                }}
                onPointerDown={engine.onPointerDown}
                onPointerMove={engine.onPointerMove}
                onPointerUp={engine.onPointerUp}
                onPointerCancel={engine.onPointerCancel}
                onPointerLeave={engine.onPointerLeave}
                onLostPointerCapture={engine.onLostPointerCapture}
                onContextMenu={(e: { preventDefault: () => void }) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    marginLeft: -bookW / 2,
                    width: bookW,
                    height: H,
                    perspective: W * 4,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    touchAction: settings.mobileScrollSupport ? 'pan-y' : 'none',
                }}
            >
                <FlipPageSizeContext.Provider value={sizeValue}>{leaves}</FlipPageSizeContext.Provider>
            </div>
        </div>
    );
});

HTMLFlipBookForward.displayName = 'HTMLFlipBook';

export const HTMLFlipBook = React.memo(HTMLFlipBookForward);
