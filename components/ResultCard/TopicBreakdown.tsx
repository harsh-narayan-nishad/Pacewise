"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/storage";
import { isApiEnabled } from "@/lib/api/config";
import { ApiError } from "@/lib/api/client";
import { historyApi } from "@/lib/api/endpoints";
import { accuracyOf, editWindow, formatLeft, groupByLevel, mergeTopics, type TopicLevel, type TopicScore } from "@/lib/topicAnalytics";

const GROUPS: { level: TopicLevel; label: string; tone: string }[] = [
  { level: "strong", label: "Strong", tone: "text-accent-medium" },
  { level: "medium", label: "Medium", tone: "text-accent-fast" },
  { level: "weak", label: "Needs work", tone: "text-accent-extreme" },
];

interface Props {
  /** Local history entry the topics belong to. */
  entryId: string;
  /** When the test was taken (ISO). Topics can be edited for 2 days after this. */
  attemptedAt: string;
  /** The same attempt on the backend, when signed in. The server enforces the 2-day rule too. */
  backendId?: string;
  topics: TopicScore[];
  /** Render without the outer card (used inside the "Past test attempts" list). */
  bare?: boolean;
  onSaved?: (topics: TopicScore[]) => void;
}

/** Strong / medium / weak topics of one test, editable for 2 days after the attempt. Only the names change; the score never does. */
export function TopicBreakdown({ entryId, attemptedAt, backendId, topics, bare, onSaved }: Props) {
  const [current, setCurrent] = useState<TopicScore[]>(topics);
  const [draft, setDraft] = useState<TopicScore[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => setCurrent(topics), [topics]);

  const win = editWindow(attemptedAt);
  const locked = win.locked || closed;
  const grouped = groupByLevel(current);

  async function save() {
    if (!draft || saving) return;
    const merged = mergeTopics(draft);
    if (merged.length === 0) { setError("Add at least one topic."); return; }
    setSaving(true);
    setError(null);
    try {
      if (backendId && isApiEnabled()) await historyApi.updateTopics(backendId, merged);
      storage.updateHistoryEntry(entryId, { topics: merged });
      setCurrent(merged);
      setDraft(null);
      onSaved?.(merged);
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOPICS_LOCKED") { setClosed(true); setDraft(null); }
      else setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-4xl">Topics.</h2>
        {draft ? (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(null); setError(null); }} disabled={saving}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>
        ) : locked ? (
          <span className="text-sm text-ink-faint">Locked</span>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-faint">Editable for {formatLeft(win.msLeft)}</span>
            <Button size="sm" variant="ghost" onClick={() => setDraft(current.map((t) => ({ ...t })))}>
              <Pencil className="h-4 w-4" /> Edit topics
            </Button>
          </div>
        )}
      </div>

      {draft ? (
        <ul className="space-y-2">
          {draft.map((t, i) => (
            <li key={i} className="flex items-center gap-3">
              <input
                value={t.topic}
                maxLength={80}
                onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, topic: e.target.value } : d)))}
                aria-label="Topic name"
                className="min-w-0 flex-1 border-b border-overlay/20 bg-transparent py-2 text-base text-ink outline-none focus:border-ink"
              />
              <span className="shrink-0 text-sm text-ink-muted">{t.correct}/{t.total}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-5">
          {GROUPS.map(({ level, label, tone }) =>
            grouped[level].length === 0 ? null : (
              <div key={level}>
                <div className="mb-2 text-sm text-ink-muted">{label} <span className="text-ink-faint">{grouped[level].length}</span></div>
                <div className="flex flex-wrap gap-2">
                  {grouped[level].map((t) => (
                    <span key={t.topic} className={`rounded-full border border-overlay/15 px-4 py-1.5 text-sm ${tone}`}>
                      {t.topic} · {accuracyOf(t)}% <span className="text-ink-faint">({t.correct}/{t.total})</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-accent-extreme">{error}</p>}
    </>
  );

  return bare ? <div className="px-5 pb-5 pt-1 sm:px-7">{body}</div> : <section className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-5 pb-8 pt-8 sm:px-10 sm:pt-12">{body}</section>;
}
