'use client';

import { useEffect, useRef } from 'react';
import { storage } from '@/lib/storage';

const TICK_MS = 1000;
const IDLE_MS = 90_000; // same as the reader's own clock: no input for 90 s (and auto flip off) means away

/**
 * Adds the time spent reading a book in the flip book to the signed-in user's time log, as reading
 * (Profile → Time spent: the Reading total and a row for the book, like any story). Only real reading
 * counts: a book is open, the tab is visible and focused, and the reader has been active in the last
 * 90 s or auto flip is playing. Saved when the tab is hidden, the page closes, or the book changes;
 * visits under 3 s are dropped by the time log itself.
 */
export function useFlipbookTimeLog(bookKey: string | null, title: string | null, autoPlaying: boolean): void {
    const playRef = useRef(autoPlaying);
    playRef.current = autoPlaying;

    useEffect(() => {
        if (!bookKey || !title) return undefined;
        const storyId = `flipbook-${bookKey}`;
        let pending = 0;
        let lastTick = Date.now();
        let lastActive = Date.now();

        const flush = () => {
            if (pending <= 0) return;
            storage.recordStoryReading(storyId, title, pending);
            pending = 0;
        };
        const touch = () => {
            lastActive = Date.now();
        };
        const tick = () => {
            const now = Date.now();
            const dt = Math.min(2500, now - lastTick); // a sleeping laptop must not add hours
            lastTick = now;
            const visible = document.visibilityState === 'visible' && document.hasFocus();
            const active = now - lastActive < IDLE_MS || playRef.current;
            if (visible && active) pending += dt;
        };
        const onHide = () => {
            if (document.visibilityState === 'hidden') flush();
        };

        const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
        events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
        const timer = window.setInterval(tick, TICK_MS);
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', flush);
        return () => {
            window.clearInterval(timer);
            events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', flush);
            flush();
        };
    }, [bookKey, title]);
}
