'use client';

import { useEffect, useRef, useState } from 'react';

import { dayKey, DayTotals, lastDays, loadTimes, saveTimes } from '@/lib/flipreader/readingtime';

/** A reader who has not touched the screen for this long is considered away (unless auto flip is running). */
const IDLE_MS = 90_000;
const FLUSH_MS = 5_000;

/** The current time, as HH:MM, updated every few seconds. */
export function useClock(): string {
    const fmt = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const [now, setNow] = useState(fmt);
    useEffect(() => {
        const t = setInterval(() => setNow(fmt()), 5000);
        setNow(fmt());
        return () => clearInterval(t);
    }, []);
    return now;
}

/**
 * Counts the time spent reading today. Time only counts while a book is open, the tab is visible and focused,
 * and the reader is active (touched / typed / scrolled in the last 90 s, or auto flip is playing).
 * The numbers are saved every few seconds, so closing the tab loses almost nothing.
 */
export function useReadingTime(bookOpen: boolean, autoPlaying: boolean) {
    const [totals, setTotals] = useState<DayTotals>({});
    const [counting, setCounting] = useState(false);

    const openRef = useRef(bookOpen);
    const playRef = useRef(autoPlaying);
    openRef.current = bookOpen;
    playRef.current = autoPlaying;

    useEffect(() => {
        let data = loadTimes();
        setTotals(data);

        let lastTick = Date.now();
        let lastActive = Date.now();
        let pending = 0; // ms not yet written
        let lastFlush = Date.now();
        let wasCounting = false;

        const touch = () => {
            lastActive = Date.now();
        };
        const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
        events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));

        const flush = () => {
            if (pending <= 0) return;
            // another tab may have saved meanwhile: add to what is stored, never overwrite it
            data = loadTimes();
            const k = dayKey();
            data[k] = (data[k] ?? 0) + pending / 1000;
            pending = 0;
            lastFlush = Date.now();
            saveTimes(data);
            setTotals({ ...data });
        };

        const tick = () => {
            const now = Date.now();
            const dt = Math.min(2500, now - lastTick); // a sleeping laptop must not add hours
            lastTick = now;

            const visible = document.visibilityState === 'visible' && document.hasFocus();
            const active = now - lastActive < IDLE_MS || playRef.current;
            const on = openRef.current && visible && active;
            if (on) pending += dt;
            if (on !== wasCounting) {
                wasCounting = on;
                setCounting(on);
            }
            if (now - lastFlush >= FLUSH_MS) flush();
        };

        const timer = setInterval(tick, 1000);
        const onHide = () => flush();
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onHide);
        return () => {
            clearInterval(timer);
            events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onHide);
            flush();
        };
    }, []);

    const today = totals[dayKey()] ?? 0;
    return { today, week: lastDays(totals, 7), counting };
}
