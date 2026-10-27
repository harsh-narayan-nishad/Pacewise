"use client";

import React, { useMemo, useState } from "react";
import { Check, Circle, Flag } from "lucide-react";
import AnimatedList, { type AnimatedListEntry } from "@/components/ui/AnimatedList";
import { StoryQuestion } from "@/types";
import { cn } from "@/lib/utils";

export type QuestionStatus = "unanswered" | "completed" | "skipped";

interface Props {
  questions: StoryQuestion[];
  current: number;
  statuses: QuestionStatus[];
  /** Question indexes the person marked to review later. */
  marked: ReadonlySet<number>;
  onSelect: (index: number) => void;
}

// Re-skins the list with this app's own tokens, so it follows the dark / light / sepia theme.
const THEME_VARS = {
  "--al-frame": "transparent",
  "--al-frame-edge": "transparent",
  "--al-frame-highlight": "transparent",
  "--al-frame-shadow": "none",
  "--al-tile": "rgb(var(--canvas))",
  "--al-tile-edge": "rgb(var(--overlay) / 0.1)",
  "--al-tile-highlight": "transparent",
  "--al-tile-shadow": "none",
  "--al-well": "rgb(var(--overlay) / 0.08)",
  "--al-ink": "rgb(var(--ink))",
  "--al-muted": "rgb(var(--ink-muted))",
  "--al-thumb": "rgb(var(--overlay) / 0.18)",
  "--al-ring": "rgb(var(--ink) / 0.45)",
  "--al-ring-fill": "transparent",
  "--al-hover": "none",
  "--al-press": "none",
  "--al-active": "none",
} as React.CSSProperties;

type Filter = "completed" | "marked" | "notCompleted";

const FILTERS: { id: Filter; label: string; Icon: typeof Check }[] = [
  { id: "completed", label: "Completed", Icon: Check },
  { id: "marked", label: "Marked for review", Icon: Flag },
  { id: "notCompleted", label: "Not completed", Icon: Circle },
];

function statusLabel(status: QuestionStatus, marked: boolean): string {
  if (marked) return "Marked for review";
  if (status === "completed") return "Completed";
  if (status === "skipped") return "Skipped";
  return "Not answered";
}

/** Right-hand panel of the quiz: how many are completed, which are marked for review, and a Done button. */
export function QuestionTracker({ questions, current, statuses, marked, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter | null>(null);
  const completed = statuses.filter((s) => s === "completed").length;
  const counts: Record<Filter, number> = {
    completed,
    marked: marked.size,
    notCompleted: statuses.filter((s) => s !== "completed").length,
  };

  const matches = (i: number) =>
    filter === null ||
    (filter === "completed" && statuses[i] === "completed") ||
    (filter === "marked" && marked.has(i)) ||
    (filter === "notCompleted" && statuses[i] !== "completed");

  /** Indexes (into `questions`) currently shown, so a click on a filtered row still jumps to the right question. */
  const visible = useMemo(
    () => questions.map((_, i) => i).filter(matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, statuses, marked, filter]
  );

  const items = useMemo<AnimatedListEntry[]>(
    () =>
      visible.map((i) => {
        const isMarked = marked.has(i);
        const done = statuses[i] === "completed";
        const lead =
          i === current ? (
            <span className="grid h-full w-full place-items-center bg-ink text-sm font-medium text-canvas">{i + 1}</span>
          ) : isMarked ? (
            <Flag className="h-4 w-4 text-accent-fast" />
          ) : done ? (
            <Check className="h-4 w-4 text-accent-medium" />
          ) : (
            <span className="text-sm text-ink-muted">{i + 1}</span>
          );
        return { id: i, icon: lead, title: questions[i].question, meta: statusLabel(statuses[i], isMarked) };
      }),
    [visible, questions, statuses, marked, current]
  );

  return (
    <aside aria-label="Question tracker" className="rounded-[32px] bg-canvas-raised/30 p-4 backdrop-blur-xl sm:p-8 lg:sticky lg:top-24">
      <h2 className="font-display text-2xl leading-tight sm:text-3xl tracking-[-0.03em] text-ink">Your progress</h2>
      <p className="mt-1 text-ink-muted">
        <span className="text-ink">{completed}</span> of {questions.length} completed
        {marked.size > 0 && <> · <span className="text-ink">{marked.size}</span> marked for review</>}
      </p>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-overlay/10" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={completed} aria-label="Questions completed">
        <div className="h-full rounded-full bg-accent-medium transition-all" style={{ width: `${questions.length ? (completed / questions.length) * 100 : 0}%` }} />
      </div>

      <div className="mt-5">
        <AnimatedList
          items={items}
          onItemSelect={(_, index) => onSelect(index)}
          animation="pop"
          theme="dark"
          width="100%"
          maxHeight={360}
          radius={16}
          gap={8}
          stagger={0.04}
          fadeSize={40}
          frame={false}
          showGradients
          displayScrollbar
          selectOnHover
          enableArrowNavigation
          loop={false}
          animateOnce
          initialSelectedIndex={-1}
          style={THEME_VARS}
        />
      </div>

      <div className="mt-6 flex items-center justify-center gap-4" role="group" aria-label="Filter questions">
        {FILTERS.map(({ id, label, Icon }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              title={`${label} (${counts[id]})`}
              aria-label={`${label}, ${counts[id]}`}
              aria-pressed={active}
              onClick={() => setFilter(active ? null : id)}
              className={cn(
                "relative grid h-14 w-14 place-items-center rounded-full bg-accent-medium text-white transition-all",
                active ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : "opacity-80 hover:opacity-100"
              )}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white">
                <Icon className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-canvas px-1 text-[11px] font-medium text-ink">
                {counts[id]}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
