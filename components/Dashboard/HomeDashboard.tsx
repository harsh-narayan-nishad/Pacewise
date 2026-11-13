"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Clock, Flame, Gauge, Search, TrendingUp, BookCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BRAND_BLUE } from "@/lib/brand";
import { storage } from "@/lib/storage";
import { startSwitchLoader } from "@/lib/switchLoader";
import { getAllStories } from "@/lib/storyLibrary";
import { useReadingDispatch } from "@/contexts/ReadingContext";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import type { LifetimeStats } from "@/lib/session/types";
import type { ReadingHistoryEntry, StoryData } from "@/types";

/** The user's own dashboard: shown when no story is open. All data is read from the active user's namespace. */
export function HomeDashboard() {
  const router = useRouter();
  const dispatch = useReadingDispatch();
  const user = useCurrentUser();
  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [recent, setRecent] = useState<ReadingHistoryEntry[]>([]);
  const [saved, setSaved] = useState<StoryData[]>([]);

  useEffect(() => {
    setStats(storage.getLifetimeStats());
    setRecent(storage.getHistory().slice(0, 6));
    const titles = new Set(storage.getBookmarks());
    setSaved(getAllStories().filter((s) => titles.has(s.title)).slice(0, 6));
  }, []);

  const open = (story: StoryData) => {
    dispatch({ type: "LOAD_STORY", story });
    startSwitchLoader("reading", "/");
    router.push("/");
  };
  const openByTitle = (title: string) => {
    const s = getAllStories().find((x) => x.title === title);
    if (s) open(s);
  };

  const tiles = stats
    ? [
        { icon: Flame, label: "Streak", value: `${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"}` },
        { icon: BookCheck, label: "Stories completed", value: String(stats.totalStoriesCompleted) },
        { icon: Clock, label: "Minutes read", value: String(Math.round(stats.totalMinutes)) },
        { icon: Gauge, label: "Avg effective WPM", value: String(Math.round(stats.avgEffectiveWpm)) },
        { icon: TrendingUp, label: "Longest streak", value: `${stats.longestStreak} days` },
      ]
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="font-display mb-2 text-4xl text-ink sm:text-5xl">{user ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}</h1>
      <p className="mb-10 text-lg text-ink-muted">Your reading progress at a glance.</p>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center rounded-[32px] border border-overlay/10 bg-canvas-raised px-3 py-6 text-center">
            <Icon className="mb-3 h-5 w-5 text-ink-muted" />
            <div className="font-display text-3xl leading-none tracking-[-0.03em] text-ink">{value}</div>
            <div className="mt-2 text-xs text-ink-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-4 pb-6 pt-8 sm:px-6">
          <h2 className="font-display mb-1 text-center text-3xl tracking-[-0.03em] text-ink sm:text-4xl">Recent sessions</h2>
          <p className="mb-5 text-center text-base" style={{ color: BRAND_BLUE }}>{recent.length ? `${recent.length} latest` : "Start reading"}</p>
          {recent.length === 0 ? (
            <Card className="text-sm text-ink-muted">Nothing read yet. Pick a story to begin.</Card>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => (
                <button key={r.id} onClick={() => openByTitle(r.title)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-overlay/10 bg-canvas px-4 py-3.5 text-left transition-colors hover:border-overlay/25">
                  <span className="line-clamp-1 text-sm text-ink">{r.title}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-muted">{Math.round(r.wpm)} wpm · {Math.round(r.accuracy)}%</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-4 pb-6 pt-8 sm:px-6">
          <h2 className="font-display mb-1 text-center text-3xl tracking-[-0.03em] text-ink sm:text-4xl">Saved stories</h2>
          <p className="mb-5 text-center text-base" style={{ color: BRAND_BLUE }}>{saved.length ? `${saved.length} saved` : "Nothing saved yet"}</p>
          {saved.length === 0 ? (
            <Card className="flex items-center gap-2 text-sm text-ink-muted"><Bookmark className="h-4 w-4" /> Bookmark a story to find it here.</Card>
          ) : (
            <div className="space-y-2">
              {saved.map((s) => (
                <button key={s.title} onClick={() => open(s)} className="flex w-full items-center gap-3 rounded-2xl border border-overlay/10 bg-canvas px-4 py-3.5 text-left transition-colors hover:border-overlay/25">
                  <Bookmark className="h-4 w-4 shrink-0 text-ink-muted" />
                  <span className="line-clamp-1 text-sm text-ink">{s.title}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={() => { dispatch({ type: "CLEAR_STORY" }); router.push("/"); }}><Search className="h-4 w-4" /> Find a story</Button>
        <Button variant="outline" onClick={() => router.push("/results")}>Analytics</Button>
        <Button variant="outline" onClick={() => router.push("/history")}>Past test attempts</Button>
      </div>
    </main>
  );
}
