"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/Pagination";
import { storage } from "@/lib/storage";
import { historyApi } from "@/lib/api/endpoints";
import { isApiEnabled } from "@/lib/api/config";
import { tokenStore } from "@/lib/api/tokenStore";
import { groupByDateBucket } from "@/lib/dateGroups";
import { ReadingHistoryEntry } from "@/types";

const PAGE_SIZE = 10;

/** Every story read, newest first. Shared by /reading-history and the profile tab. */
export function ReadingHistoryPanel() {
  const [entries, setEntries] = useState<ReadingHistoryEntry[] | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const local = storage.getHistory();
    // Signed in: the list comes from the database, plus anything this browser has that the server doesn't yet.
    if (!isApiEnabled() || !tokenStore.getAccessToken()) { setEntries(local); return; }
    let cancelled = false;
    historyApi.list(1, 100).then((res) => {
      if (cancelled) return;
      const remote: ReadingHistoryEntry[] = res.items.filter((r) => r.wpm > 0).map((r) => ({
        id: r.id, backendId: r.id, title: r.title ?? "Reading session", date: r.createdAt, wpm: r.wpm, accuracy: r.accuracy ?? 0, wordCount: r.wordCount ?? 0,
      }));
      const known = new Set(remote.map((r) => r.id));
      const near = (a: ReadingHistoryEntry) => remote.some((r) => r.title === a.title && Math.abs(new Date(r.date).getTime() - new Date(a.date).getTime()) < 120_000);
      const extra = local.filter((l) => !(l.backendId && known.has(l.backendId)) && !near(l));
      setEntries([...remote, ...extra].sort((a, b) => b.date.localeCompare(a.date)));
    }).catch(() => { if (!cancelled) setEntries(local); });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => (entries ? groupByDateBucket(entries, (e) => e.date) : []), [entries]);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pageGroups = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {!entries ? null : entries.length === 0 ? (
        <Card className="rounded-[32px] bg-canvas-raised py-12 text-center text-sm text-ink-muted">Nothing here yet — finish a story to see it listed.</Card>
      ) : (
        <>
          <div className="space-y-5">
            {pageGroups.map(([label, group]) => (
              <div key={label}>
                <div className="mb-2 px-3 font-display text-xl tracking-[-0.02em] text-ink-muted">{label}</div>
                <Card className="divide-y divide-overlay/10 overflow-hidden rounded-[32px] bg-canvas-raised p-0">
                  {group.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-4 sm:px-7">
                      <BookOpen className="h-4 w-4 shrink-0 text-ink-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink">{e.title}</div>
                        <div className="text-xs text-ink-muted">
                          {new Date(e.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {e.wordCount.toLocaleString()} words
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-medium text-ink">{Math.round(e.wpm)} wpm</div>
                    </div>
                  ))}
                </Card>
              </div>
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} className="mt-6" />
        </>
      )}
    </>
  );
}
