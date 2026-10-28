"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, Check, X } from "lucide-react";
import { BRAND_BLUE } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/Pagination";
import { storage } from "@/lib/storage";
import { ReadingHistoryEntry } from "@/types";
import { formatDuration } from "@/lib/wpmCalculator";
import { groupByDateBucket } from "@/lib/dateGroups";

const PAGE_SIZE = 10;

/** Past test attempts list. Shared by the /history page and the profile's "Past test attempts" tab. */
export function TestAttemptsPanel({ showHeading = true }: { showHeading?: boolean }) {
  const [attempts, setAttempts] = useState<ReadingHistoryEntry[] | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof storage.getQuizStats> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setAttempts(storage.getQuizAttempts());
    setStats(storage.getQuizStats());
  }, []);

  const groups = useMemo(() => (attempts ? groupByDateBucket(attempts, (a) => a.date) : []), [attempts]);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pageGroups = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className={showHeading ? "mb-6 flex flex-wrap items-center justify-between gap-2" : "mb-4 flex justify-end"}>
        {showHeading && <h1 className="font-display text-3xl text-ink">Past test attempts</h1>}
        {stats && stats.attemptCount > 0 && (
          <span className="text-sm sm:text-base" style={{ color: BRAND_BLUE }}>
            {stats.attemptCount} {stats.attemptCount === 1 ? "test" : "tests"} · avg {stats.avgAccuracy.toFixed(0)}%
            · avg {formatDuration(stats.avgTimePerQuestionMs)}/question
          </span>
        )}
      </div>

      {!attempts ? null : attempts.length === 0 ? (
        <Card className="rounded-[32px] bg-canvas-raised py-12 text-center text-sm text-ink-muted">
          No quiz attempts yet — finish a story's comprehension check to see it here.
        </Card>
      ) : (
        <>
          <div className="space-y-5">
            {pageGroups.map(([label, group]) => (
              <div key={label}>
                <div className="mb-2 px-3 font-display text-xl tracking-[-0.02em] text-ink-muted">{label}</div>
                <Card className="divide-y divide-overlay/10 overflow-hidden rounded-[32px] bg-canvas-raised p-0">
                  {group.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-4 sm:px-7">
                      <ClipboardList className="h-4 w-4 shrink-0 text-ink-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink">{a.title}</div>
                        <div className="text-xs text-ink-muted">
                          {a.quizStartedAt ? `Started ${new Date(a.quizStartedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : new Date(a.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          {typeof a.quizTotalTimeMs === "number" && a.quizTotalTimeMs > 0 && <> · took {formatDuration(a.quizTotalTimeMs)}</>}
                          {typeof a.totalQuestions === "number" && typeof a.correctAnswers === "number" && (
                            <> · {a.correctAnswers}/{a.totalQuestions} correct</>
                          )}
                          {typeof a.avgTimePerQuestionMs === "number" && (
                            <> · {formatDuration(a.avgTimePerQuestionMs)}/question</>
                          )}
                        </div>
                      </div>
                      <div
                        className={`flex shrink-0 items-center gap-1 text-sm font-medium ${
                          a.accuracy >= 70 ? "text-accent-medium" : a.accuracy >= 40 ? "text-accent-fast" : "text-accent-extreme"
                        }`}
                      >
                        {a.accuracy >= 70 ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {a.accuracy.toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ))}
          </div>

          <Pagination page={page} pageCount={pageCount} onChange={setPage} className="mt-6" />
        </>
      )}
    </div>
  );
}
