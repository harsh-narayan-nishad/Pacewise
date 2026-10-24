"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Clock, Flame, Gauge, Search, TrendingUp, BookCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/storage";
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
    <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-24">
      <h1 className="font-display mb-2 text-4xl text-ink sm:text-5xl">{user ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}</h1>
      <p className="mb-10 text-lg text-ink-muted">Your reading progress at a glance.</p>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="p-4">
            <Icon className="mb-3 h-4 w-4 text-ink-muted" />
            <div className="font-display text-2xl text-ink">{value}</div>
            <div className="mt-1 text-xs uppercase text-ink-muted">{label}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="font-display mb-3 text-2xl text-ink">Recent sessions</h2>
          {recent.length === 0 ? (
            <Card className="text-sm text-ink-muted">Nothing read yet. Pick a story to begin.</Card>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => (
                <button key={r.id} onClick={() => openByTitle(r.title)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-overlay/10 bg-canvas-raised/60 px-4 py-3 text-left transition-colors hover:border-overlay/25">
                  <span className="line-clamp-1 text-sm text-ink">{r.title}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-muted">{Math.round(r.wpm)} wpm · {Math.round(r.accuracy)}%</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display mb-3 text-2xl text-ink">Saved stories</h2>
          {saved.length === 0 ? (
            <Card className="flex items-center gap-2 text-sm text-ink-muted"><Bookmark className="h-4 w-4" /> Bookmark a story to find it here.</Card>
          ) : (
            <div className="space-y-2">
              {saved.map((s) => (
                <button key={s.title} onClick={() => open(s)} className="flex w-full items-center gap-3 rounded-xl border border-overlay/10 bg-canvas-raised/60 px-4 py-3 text-left transition-colors hover:border-overlay/25">
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
