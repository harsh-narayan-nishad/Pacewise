"use client";
import { BRAND_NAME } from "@/lib/brand";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Hash } from "lucide-react";
import { AudienceMarquee } from "@/components/Landing/AudienceMarquee";
import { VideoShowcase } from "@/components/Landing/VideoShowcase";
import { storage, toDateKey } from "@/lib/storage";
import { getAllStories } from "@/lib/storyLibrary";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { startSwitchLoader } from "@/lib/switchLoader";
import type { ReadingHistoryEntry, StoryData } from "@/types";
import { historyApi } from "@/lib/api/endpoints";
import { isApiEnabled } from "@/lib/api/config";
import { tokenStore } from "@/lib/api/tokenStore";

/**
 * The landing page's second "page": sits under the story feed, just above
 * the footer. Both blocks use real data from this platform (no invented
 * logos or benchmark numbers):
 *   1. "Topics readers love" — tiles for the most common tags in the library.
 *   2. "Performance that stands out" — the signed-in user's own best speed,
 *      comprehension and consistency, as bars.
 */
/** "Read faster. Remember more." — the video section. Rendered by SearchLanding right after the hero, before "The latest.". */
export function PlatformVideo() {
  return (
    <>
      {/* Full-bleed on the page background, so the landing's guide lines don't run through the video. */}
      <div className="relative z-10 bg-canvas pb-28 pt-10 sm:pb-40 sm:pt-12">
        <VideoShowcase />
      </div>
    </>
  );
}

export function PlatformShowcase() {
  return (
    <>
      {/* Full-bleed on the page background too: the guide lines stop above this section. */}
      <div className="relative z-10 overflow-x-clip bg-canvas pb-28 sm:pb-40">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <AudienceMarquee />
        </div>
      </div>
      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-28 overflow-x-clip px-6 pb-32 sm:space-y-40 sm:px-8">
        <Topics />
        <Performance />
      </div>
    </>
  );
}

// --- 1. Topics ---------------------------------------------------------------------------------

interface Topic { name: string; count: number; first: StoryData }

function topicsOf(stories: StoryData[]): Topic[] {
  const map = new Map<string, Topic>();
  for (const s of stories) {
    const labels = s.tags && s.tags.length ? s.tags : [s.difficulty ?? s.level].filter(Boolean) as string[];
    for (const raw of labels) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const cur = map.get(key);
      if (cur) cur.count += 1;
      else map.set(key, { name, count: 1, first: s });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function Topics() {
  const router = useRouter();
  const dispatch = useReadingDispatch();
  const [stories, setStories] = useState<StoryData[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => setStories(getAllStories()), []);
  const topics = useMemo(() => topicsOf(stories), [stories]);
  if (topics.length === 0) return null;
  const shown = all ? topics.slice(0, 18) : topics.slice(0, 6);

  return (
    <section aria-labelledby="topics-h">
      <div className="mb-12 flex items-end justify-between gap-4">
        <h2 id="topics-h" className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Topics readers love on {BRAND_NAME}
        </h2>
        {topics.length > 6 && (
          <button onClick={() => setAll((v) => !v)} className="flex shrink-0 items-center gap-1.5 text-base text-ink-muted transition-colors hover:text-ink">
            {all ? "Show less" : "See all"} <ArrowRight className={`h-4 w-4 transition-transform ${all ? "-rotate-90" : ""}`} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {shown.map((t) => (
          <button
            key={t.name}
            onClick={() => { dispatch({ type: "LOAD_STORY", story: t.first }); startSwitchLoader("reading", "/"); router.push("/"); }}
            className="flex h-32 flex-col items-center justify-center gap-1 rounded-2xl bg-overlay/[0.04] px-3 text-center transition-colors hover:bg-overlay/[0.08]"
          >
            <span className="flex items-center gap-1.5 text-lg font-medium text-ink"><Hash className="h-4 w-4 text-ink-muted" />{t.name}</span>
            <span className="text-xs text-ink-muted">{t.count} {t.count === 1 ? "story" : "stories"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// --- 2. Performance ----------------------------------------------------------------------------

interface Row { label: string; value: number; display: string }

function lastWeeksActiveDays(weeks: number): Row[] {
  const activity = storage.getDailyActivity();
  const rows: Row[] = [];
  const today = new Date();
  for (let w = 0; w < weeks; w += 1) {
    let days = 0;
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - w * 7 - d);
      if ((activity[toDateKey(date)]?.sessions ?? 0) > 0) days += 1;
    }
    rows.push({ label: w === 0 ? "Last 7 days" : w === 1 ? "Week before" : `${w + 1} weeks ago`, value: days / 7, display: `${days}/7 days` });
  }
  return rows;
}

function bestOf(history: ReadingHistoryEntry[], pick: (h: ReadingHistoryEntry) => number, scale: number, fmt: (n: number) => string): Row[] {
  return history
    .filter((h) => pick(h) > 0)
    .sort((a, b) => pick(b) - pick(a))
    .slice(0, 4)
    .map((h) => ({ label: h.title, value: Math.min(1, pick(h) / scale), display: fmt(pick(h)) }));
}

function Performance() {
  const [cols, setCols] = useState<Array<{ title: string; rows: Row[] }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fromThisBrowser = () => {
      const history = storage.getHistory();
      const topWpm = Math.max(400, ...history.map((h) => h.wpm));
      setCols([
        { title: "Speed", rows: bestOf(history, (h) => h.wpm, topWpm, (n) => `${Math.round(n)} wpm`) },
        { title: "Comprehension", rows: bestOf(history, (h) => h.accuracy, 100, (n) => `${Math.round(n)}%`) },
        { title: "Consistency", rows: lastWeeksActiveDays(4) },
      ]);
    };
    // Signed in: the numbers come from the database (through the backend). Otherwise, or if the backend can't be reached, this browser's own data is shown.
    if (!isApiEnabled() || !tokenStore.getAccessToken()) { fromThisBrowser(); return; }
    historyApi.highlights(toDateKey()).then((h) => {
      if (cancelled) return;
      const topWpm = Math.max(400, ...h.speed.map((r) => r.wpm));
      setCols([
        { title: "Speed", rows: h.speed.map((r) => ({ label: r.title, value: Math.min(1, r.wpm / topWpm), display: `${Math.round(r.wpm)} wpm` })) },
        { title: "Comprehension", rows: h.comprehension.map((r) => ({ label: r.title, value: Math.min(1, r.accuracy / 100), display: `${Math.round(r.accuracy)}%` })) },
        { title: "Consistency", rows: h.consistency.map((c) => ({ label: c.weeksAgo === 0 ? "Last 7 days" : c.weeksAgo === 1 ? "Week before" : `${c.weeksAgo + 1} weeks ago`, value: c.activeDays / 7, display: `${c.activeDays}/7 days` })) },
      ]);
    }).catch(() => { if (!cancelled) fromThisBrowser(); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section aria-labelledby="perf-h">
      <h2 id="perf-h" className="font-display text-3xl leading-tight text-ink sm:text-5xl">Performance that stands out</h2>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">
        Your own numbers, straight from your reading sessions: your fastest reads, your best quiz scores, and how steadily you show up.
      </p>
      <div className="mt-16 grid gap-14 md:grid-cols-3 md:gap-14">
        {(cols ?? []).map((c) => (
          <div key={c.title}>
            <h3 className="mb-6 text-xl text-ink">{c.title}</h3>
            {c.rows.length === 0 || c.rows.every((r) => r.value === 0) ? (
              <p className="text-sm text-ink-muted">Nothing yet. Finish a story and this fills in.</p>
            ) : (
              <ul className="space-y-4">
                {c.rows.map((r, i) => (
                  <li key={`${r.label}-${i}`} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className={`truncate ${i === 0 ? "font-medium text-ink" : "text-ink-muted"}`} title={r.label}>{r.label}</span>
                    <span className="h-8 overflow-hidden rounded-lg bg-overlay/[0.05]">
                      <span
                        className={`block h-full rounded-lg transition-[width] duration-700 ${i === 0 ? "bg-gradient-to-r from-accent-slow to-accent-medium" : "bg-overlay/[0.09]"}`}
                        style={{ width: `${Math.max(2, r.value * 100)}%` }}
                      />
                    </span>
                    <span className={`w-16 text-right tabular-nums ${i === 0 ? "text-ink" : "text-ink-muted"}`}>{r.display}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
