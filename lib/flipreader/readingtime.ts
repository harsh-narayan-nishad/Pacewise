/** Time spent reading, per calendar day, kept in this browser (localStorage). */
const KEY = 'reader.time.v1';
const KEEP_DAYS = 60;

export type DayTotals = Record<string, number>; // 'YYYY-MM-DD' -> seconds

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function loadTimes(): DayTotals {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
        const out: DayTotals = {};
        if (raw && typeof raw === 'object') {
            for (const [k, v] of Object.entries(raw)) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
            }
        }
        return out;
    } catch {
        return {};
    }
}

export function saveTimes(totals: DayTotals) {
    try {
        const keys = Object.keys(totals).sort().slice(-KEEP_DAYS);
        const trimmed: DayTotals = {};
        keys.forEach((k) => (trimmed[k] = Math.round(totals[k] * 10) / 10));
        localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
        /* storage unavailable: the counter just starts again next time */
    }
}

/** "1h 23m", "23m" or "45s" */
export function formatDuration(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${pad(m)}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
}

export interface DayBar {
    key: string;
    label: string;
    seconds: number;
    today: boolean;
}

/** The last `n` days, oldest first, for a small bar chart. */
export function lastDays(totals: DayTotals, n = 7, now: Date = new Date()): DayBar[] {
    const names = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const out: DayBar[] = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = dayKey(d);
        out.push({ key, label: names[d.getDay()], seconds: totals[key] ?? 0, today: i === 0 });
    }
    return out;
}
