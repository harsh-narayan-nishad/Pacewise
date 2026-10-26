"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/PageShell";
import { Pagination } from "@/components/ui/Pagination";
import { storage } from "@/lib/storage";
import { groupByDateBucket } from "@/lib/dateGroups";
import { ReadingHistoryEntry } from "@/types";

const PAGE_SIZE = 10;

export default function ReadingHistoryPage() {
  const [entries, setEntries] = useState<ReadingHistoryEntry[] | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => setEntries(storage.getHistory()), []);

  const groups = useMemo(() => (entries ? groupByDateBucket(entries, (e) => e.date) : []), [entries]);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pageGroups = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageShell title="Reading history" subtitle="Every story you've read, newest first.">
      {!entries ? null : entries.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-muted">Nothing here yet — finish a story to see it listed.</Card>
      ) : (
        <>
          <div className="space-y-5">
            {pageGroups.map(([label, group]) => (
              <div key={label}>
                <div className="mb-1.5 px-1 text-xs font-medium text-ink-faint">{label}</div>
                <Card className="divide-y divide-overlay/10 p-0">
                  {group.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
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
    </PageShell>
  );
}
