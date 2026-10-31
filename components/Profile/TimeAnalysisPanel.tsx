"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useUserSession } from "@/lib/session/useUserSession";
import { StoryTimeRecord } from "@/lib/session/analytics/StoryTimeRecord";
import { formatShortDuration } from "@/lib/wpmCalculator";
import { BRAND_BLUE } from "@/lib/brand";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-2 font-display text-3xl leading-none tracking-[-0.03em] text-ink">{value}</div>
      {hint && <div className="mt-2 text-xs text-ink-muted">{hint}</div>}
    </Card>
  );
}

/** Page-by-page reading time of one story: one bar per page, the slowest page marked. */
function PageBreakdown({ record }: { record: StoryTimeRecord }) {
  const max = Math.max(1, ...record.pages);
  const slowest = record.slowestPage();
  if (record.pages.length === 0) {
    return <p className="px-1 pb-1 pt-3 text-sm text-ink-muted">No page-by-page detail for this story (it was read with the auto-scroll reader). Reading mode records every page.</p>;
  }
  return (
    <ul className="space-y-2 px-1 pb-1 pt-4" aria-label={`Time per page for ${record.title}`}>
      {record.pages.map((ms, i) => (
        <li key={i} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3 text-sm">
          <span className="text-ink-muted">Page {i + 1}</span>
          <span className="h-2 overflow-hidden rounded-full bg-overlay/10" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${(ms / max) * 100}%`, backgroundColor: i === slowest ? "#E05B5B" : BRAND_BLUE }} />
          </span>
          <span className="text-right tabular-nums text-ink">{formatShortDuration(ms)}{i === slowest ? " ·" : ""}</span>
        </li>
      ))}
      <li className="pt-1 text-xs text-ink-muted">A page is about 250 words. The longest page is shown in red.</li>
    </ul>
  );
}

/**
 * Profile → "Time spent": the totals (reading, testing, both) and, for every story, how long was spent
 * reading it, testing on it and on each page. Reads the signed-in user's own time log.
 */
export function TimeAnalysisPanel() {
  const session = useUserSession();
  const records = useMemo(() => session.timeLog.getAll(), [session]);
  const docs = useMemo(() => session.docTime.getAll(), [session]);
  const summary = useMemo(() => session.timeSummary(), [session]);
  const [open, setOpen] = useState<string | null>(null);

  if (records.length === 0 && docs.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing yet. Read a story, take a test or open the documentation and the time you spend shows up here, story by story and page by page.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Total time" value={formatShortDuration(summary.totalMs)} hint="Reading + testing + docs" />
        <Stat label="Reading" value={formatShortDuration(summary.readingMs)} hint={`${summary.readingSessions} session${summary.readingSessions === 1 ? "" : "s"}`} />
        <Stat label="Testing" value={formatShortDuration(summary.testMs)} hint={`${summary.testSessions} test${summary.testSessions === 1 ? "" : "s"}`} />
        <Stat label="Documentation" value={formatShortDuration(summary.docMs)} hint={`${summary.docCount} page${summary.docCount === 1 ? "" : "s"}`} />
        <Stat label="Stories" value={String(summary.storyCount)} hint="With time recorded" />
      </div>

      {records.length > 0 && <h3 className="mb-3 mt-10 text-xs font-medium uppercase tracking-wide text-ink-muted">Story by story</h3>}
      <ul className="space-y-3">
        {records.map((r) => {
          const isOpen = open === r.storyId;
          const readShare = r.totalMs > 0 ? (r.readingMs / r.totalMs) * 100 : 0;
          return (
            <li key={r.storyId}>
              <Card className="p-0">
                <button type="button" onClick={() => setOpen(isOpen ? null : r.storyId)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg tracking-[-0.02em] text-ink">{r.title}</span>
                    <span className="mt-1 block text-sm text-ink-muted">
                      Reading {formatShortDuration(r.readingMs)} · Test {formatShortDuration(r.testMs)} · {new Date(r.lastAt).toLocaleDateString()}
                    </span>
                    <span className="mt-3 flex h-2 overflow-hidden rounded-full bg-overlay/10" aria-hidden>
                      <span className="h-full" style={{ width: `${readShare}%`, backgroundColor: BRAND_BLUE }} />
                      <span className="h-full bg-ink/40" style={{ width: `${100 - readShare}%` }} />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-2xl tabular-nums tracking-[-0.02em] text-ink">{formatShortDuration(r.totalMs)}</span>
                    <span className="block text-xs text-ink-muted">total</span>
                  </span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-ink ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-overlay/10 px-5 pb-5">
                    <div className="grid grid-cols-2 gap-3 pt-4 text-sm sm:grid-cols-4">
                      <span><span className="block text-xs text-ink-muted">Reading</span>{formatShortDuration(r.readingMs)} ({r.readingSessions}×)</span>
                      <span><span className="block text-xs text-ink-muted">Testing</span>{formatShortDuration(r.testMs)} ({r.testSessions}×)</span>
                      <span><span className="block text-xs text-ink-muted">Pages tracked</span>{r.pages.length}</span>
                      <span><span className="block text-xs text-ink-muted">Longest page</span>{r.slowestPage() >= 0 ? `Page ${r.slowestPage() + 1}` : "-"}</span>
                    </div>
                    <PageBreakdown record={r} />
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {docs.length > 0 && (
        <>
          <h3 className="mb-3 mt-10 text-xs font-medium uppercase tracking-wide text-ink-muted">Documentation, page by page</h3>
          <Card className="p-5">
            <ul className="space-y-3" aria-label="Time per documentation page">
              {[...docs].sort((a, b) => b.ms - a.ms).map((d) => (
                <li key={d.slug} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 text-sm">
                  <span className="min-w-0 truncate text-ink">{d.title}</span>
                  <span className="text-right tabular-nums text-ink">{formatShortDuration(d.ms)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-overlay/10" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${(d.ms / Math.max(1, docs.reduce((m, x) => Math.max(m, x.ms), 0))) * 100}%`, backgroundColor: BRAND_BLUE }} />
                  </span>
                  <span className="text-right text-xs text-ink-muted">{d.visits} visit{d.visits === 1 ? "" : "s"} · {new Date(d.lastAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
