/*
 * YouTube-style page gestures: hold to fast-flip, and repeated taps to skip many pages.
 * Plain classes with no React in them, so the timing logic is easy to test and tune.
 */

/* ------------------------- configuration ------------------------- */

/**
 * Repeated taps in one direction. The first tap flips one page. The 2nd tap asks for `step` pages,
 * the 3rd for 2 x step, and so on. From the `boostAfter`-th tap each extra tap adds step x boostFactor,
 * so the distance accelerates. Change these numbers (or pass your own config) to tune the curve.
 */
export const SKIP_CONFIG = {
    step: 10,
    boostAfter: 5,
    boostFactor: 2,
    /** ms allowed between two taps for them to count as one burst */
    window: 450,
    /** ms after the last tap before the accumulated skip is applied */
    applyDelay: 520,
};
export type SkipConfig = typeof SKIP_CONFIG;

/** Total pages requested after `taps` taps in a row (0 for the first tap, which flips one page). */
export function skipDistance(taps: number, cfg: SkipConfig = SKIP_CONFIG): number {
    let d = 0;
    for (let k = 2; k <= taps; k++) d += cfg.step * (k > cfg.boostAfter ? cfg.boostFactor : 1);
    return d;
}

/** Press and hold: starts calm and doubles every `doubleEverySec` seconds up to `maxPps` flips per second. */
export const HOLD_CONFIG = {
    startPps: 2,
    maxPps: 24,
    doubleEverySec: 1,
    minDuration: 55,
    maxDuration: 700,
};
export type HoldConfig = typeof HOLD_CONFIG;

export const holdSpeed = (elapsedMs: number, cfg: HoldConfig = HOLD_CONFIG) =>
    Math.min(cfg.maxPps, cfg.startPps * Math.pow(2, elapsedMs / 1000 / cfg.doubleEverySec));

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/* ------------------------- hold to fast-flip ------------------------- */

export interface FlipDriver {
    flipNext(opts?: { duration?: number }): boolean;
    flipPrev(opts?: { duration?: number }): boolean;
}

export interface HoldHud {
    dir: 1 | -1;
    /** speed relative to the starting speed, e.g. 3.2 means "3.2x" */
    mult: number;
    /** flips per second */
    pps: number;
}

export class HoldFlipper {
    private running = false;
    private dir: 1 | -1 = 1;
    private t0 = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private hudTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private getApi: () => FlipDriver | undefined,
        /** true when there is nothing further to flip in that direction */
        private atEnd: (dir: 1 | -1) => boolean,
        private onHud: (hud: HoldHud | null) => void,
        private cfg: HoldConfig = HOLD_CONFIG
    ) {}

    get active() {
        return this.running;
    }

    start(dir: 1 | -1) {
        this.stop();
        this.running = true;
        this.dir = dir;
        this.t0 = performance.now();
        this.emit();
        this.hudTimer = setInterval(() => this.emit(), 120);
        this.tick();
    }

    /** Stops immediately (button released, finger lifted, gesture cancelled, window lost focus...). */
    stop() {
        const wasRunning = this.running;
        this.running = false;
        if (this.timer) clearTimeout(this.timer);
        if (this.hudTimer) clearInterval(this.hudTimer);
        this.timer = null;
        this.hudTimer = null;
        if (wasRunning) this.onHud(null);
    }

    private emit() {
        if (!this.running) return;
        const pps = holdSpeed(performance.now() - this.t0, this.cfg);
        this.onHud({ dir: this.dir, mult: pps / this.cfg.startPps, pps });
    }

    private tick = () => {
        if (!this.running) return;
        const api = this.getApi();
        if (!api) {
            this.stop();
            return;
        }
        const pps = holdSpeed(performance.now() - this.t0, this.cfg);
        const interval = 1000 / pps;
        const duration = clamp(interval * 0.85, this.cfg.minDuration, this.cfg.maxDuration);

        const moved = this.dir === 1 ? api.flipNext({ duration }) : api.flipPrev({ duration });
        if (!moved) {
            if (this.atEnd(this.dir)) {
                this.stop();
                return;
            }
            this.timer = setTimeout(this.tick, 16); // the previous flip is still finishing
            return;
        }
        this.timer = setTimeout(this.tick, Math.max(interval, duration + 8));
    };
}

/* ------------------------- repeated taps to skip ------------------------- */

export interface SkipHud {
    dir: 1 | -1;
    label: string;
    /** true once the skip has been applied (the overlay is about to fade) */
    applied: boolean;
}

interface Burst {
    dir: 1 | -1;
    taps: number;
    base: number;
    last: number;
}

export class TapSkipper {
    private burst: Burst | null = null;
    private applyTimer: ReturnType<typeof setTimeout> | null = null;
    private hideTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private o: {
            /** page (0-based, whole book) the skip starts from, for that direction */
            getBase: (dir: 1 | -1) => number;
            getTotal: () => number;
            /** navigate to a page (0-based, whole book) */
            go: (page: number) => void;
            onHud: (hud: SkipHud | null) => void;
            cfg?: SkipConfig;
        }
    ) {}

    private get cfg() {
        return this.o.cfg ?? SKIP_CONFIG;
    }

    /**
     * Call for every tap on the left (-1) or right (1) side.
     * Returns true when the tap was absorbed into a skip, and false when it is a plain tap (flip one page).
     */
    tap(dir: 1 | -1): boolean {
        const now = performance.now();
        const b = this.burst;

        if (b && b.dir === dir && now - b.last <= this.cfg.window) {
            b.taps++;
            b.last = now;
            this.show(false);
            if (this.applyTimer) clearTimeout(this.applyTimer);
            this.applyTimer = setTimeout(() => this.apply(), this.cfg.applyDelay);
            return true;
        }

        this.flush(); // a different direction, or too slow: finish the previous burst first
        this.burst = { dir, taps: 1, base: this.o.getBase(dir), last: now };
        // a burst that never gets a second tap just expires
        this.applyTimer = setTimeout(() => this.apply(), this.cfg.applyDelay);
        return false;
    }

    /** Applies a pending skip right away. */
    flush() {
        if (this.burst && this.burst.taps >= 2) this.apply();
        else this.reset();
    }

    cancel() {
        this.reset();
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.hideTimer = null;
        this.o.onHud(null);
    }

    private reset() {
        if (this.applyTimer) clearTimeout(this.applyTimer);
        this.applyTimer = null;
        this.burst = null;
    }

    /** Where the burst would land and the label for it. */
    private plan(b: Burst) {
        const total = this.o.getTotal();
        const wanted = skipDistance(b.taps, this.cfg);
        const target = clamp(b.base + b.dir * wanted, 0, Math.max(0, total - 1));
        const delta = Math.abs(target - b.base);
        const clamped = delta < wanted;
        const sign = b.dir === 1 ? '+' : '\u2212';
        const label = delta === 0 ? (b.dir === 1 ? 'Last page' : 'First page') : `${sign}${delta} page${delta === 1 ? '' : 's'}${clamped ? ' \u00b7 end' : ''}`;
        return { target, label };
    }

    private show(applied: boolean) {
        const b = this.burst;
        if (!b || b.taps < 2) return;
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.hideTimer = null;
        this.o.onHud({ dir: b.dir, label: this.plan(b).label, applied });
    }

    private apply() {
        const b = this.burst;
        this.applyTimer = null;
        if (!b) return;
        if (b.taps >= 2) {
            const { target } = this.plan(b);
            this.show(true);
            this.o.go(target);
            this.hideTimer = setTimeout(() => this.o.onHud(null), 900);
        }
        this.burst = null;
    }
}
