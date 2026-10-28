"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { DailyActivity, storage, toDateKey } from "@/lib/storage";
import { formatShortDuration } from "@/lib/wpmCalculator";
import { PagerPill } from "@/components/Analytics/PagerPill";
import { BRAND_BLUE } from "@/lib/brand";
import { HOVER_CARD_CLASS } from "@/lib/chartStyle";
import SpinnerLoader from "@/components/ui/loaders/SpinnerLoader";

type Level = 0 | 1 | 2 | 3;

const LEVEL_CLASS: Record<Level, string> = {
  0: "bg-overlay/10",
  1: "bg-accent-medium/30",
  2: "bg-accent-medium/60",
  3: "bg-accent-medium",
};

const LEVEL_LABEL: Record<Level, string> = {
  0: "No activity",
  1: "Low",
  2: "Medium",
  3: "High",
};

/** Combines reading time and completions into one intensity score, then
 *  buckets it into four GitHub-style levels. A completion is weighted as
 *  heavily as 20 minutes of reading, since finishing a story is a
 *  stronger "active day" signal than partial minutes. */
function levelFor(entry: DailyActivity | null): Level {
  if (!entry) return 0;
  const score = entry.minutes + entry.storiesCompletedCount * 20 + (entry.testMs ?? 0) / 60_000;
  if (score <= 0) return 0;
  if (score < 15) return 1;
  if (score < 40) return 2;
  return 3;
}

const MONTHS_TO_SHOW = 12;
const CELL_PX = 11;
const GAP_PX = 3;

interface DayCell {
  date: Date;
  key: string;
  entry: DailyActivity | null;
  isFuture: boolean;
  isToday: boolean;
}

/** `null` = a structural blank cell (padding before a month's first
 *  weekday, or after its last day, to complete a 7-row column) — never a
 *  real calendar date, so it renders with no color, no border, and no
 *  interaction at all. */
type GridCell = DayCell | null;

function tooltipLines(day: DayCell): string[] {
  const label = day.date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  const entry = day.entry;
  if (!entry) return [label, "No reading activity"];
  const avgWpm = entry.effectiveWpmSamples > 0 ? Math.round(entry.effectiveWpmSum / entry.effectiveWpmSamples) : null;
  return [
    label,
    `Attempts: ${entry.sessions}`,
    `${entry.storiesCompletedCount > 0 ? "✅" : "—"} ${entry.storiesCompletedCount} ${entry.storiesCompletedCount === 1 ? "Story" : "Stories"}`,
    `Total reading time: ${formatShortDuration(entry.minutes * 60_000)}`,
    `Total test time: ${formatShortDuration(entry.testMs ?? 0)}`,
    `Effective WPM: ${avgWpm ?? "—"}`,
    `Break Time: ${entry.breakMs > 0 ? formatShortDuration(entry.breakMs) : "0s"}`,
  ];
}

/**
 * GitHub-style contribution graph, one continuous strip flowing left to
 * right — but built **month by month**, not as one uninterrupted day-by-
 * day stream. Each month gets its own run of weekday-aligned columns
 * (leading blanks so day 1 lands on its real weekday, trailing blanks to
 * complete the final week), appended left to right in chronological
 * order. Concretely: a month's last real day and the next month's first
 * real day are never in the same column — the next month always starts
 * at the top of the *next* column, padded with blanks down to its first
 * day's weekday, rather than continuing partway down a column shared
 * with the previous month. `MONTHS_TO_SHOW` months are generated this
 * way and concatenated, so there's still one uninterrupted strip on
 * screen (no per-month cards or gaps) — only the column boundaries
 * changed, not the overall continuous look.
 *
 * This is a deliberate departure from GitHub's *actual* graph, which
 * lets a week column span two months when the boundary falls mid-week —
 * implemented this way on request, to guarantee a month never appears to
 * "continue directly beneath" the previous one.
 *
 * Because it's computed from real month/weekday arithmetic
 * (`new Date(year, month + 1, 0).getDate()` for days-in-month,
 * `new Date(year, month, 1).getDay()` for the leading-blank count)
 * rather than any hardcoded table, this is correct for 28/29/30/31-day
 * months and leap years with no special-casing.
 *
 * Alignment: the month-label row and the day-grid row share the exact
 * same CSS Grid (`grid-template-columns: repeat(weeks.length, CELL_PXpx)`
 * + matching gap), so column *i* in one is column *i* in the other by
 * construction — no manual pixel-offset arithmetic to drift out of sync.
 */
export function ContributionHeatmap() {
  const [activity, setActivity] = useState<Record<string, DailyActivity> | null>(null);
  // Custom tooltip state instead of the native `title` attribute — browsers
  // apply their own ~0.5–1.5s hover delay before a `title` tooltip appears,
  // which can't be shortened from CSS/HTML. Rendering our own tooltip on
  // `onMouseEnter` shows it the instant the pointer lands on a cell.
  const [slide, setSlide] = useState(0);
  const [hovered, setHovered] = useState<{ day: DayCell; x: number; y: number } | null>(null);

  useEffect(() => {
    setActivity(storage.getDailyActivity());
  }, []);

  const stats = useMemo(() => storage.getLifetimeStats(), [activity]);

  const weeks = useMemo(() => {
    if (!activity) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cols: GridCell[][] = [];
    // Oldest month first, current month last, so the strip still reads
    // left (oldest) to right (most recent) overall.
    for (let m = MONTHS_TO_SHOW - 1; m >= 0; m--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const leadingBlanks = monthStart.getDay(); // weekday of the 1st (0 = Sunday)

      const flat: GridCell[] = [];
      for (let i = 0; i < leadingBlanks; i++) flat.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const key = toDateKey(date);
        flat.push({
          date,
          key,
          entry: activity[key] ?? null,
          isFuture: date > today,
          isToday: date.getTime() === today.getTime(),
        });
      }
      // Pad the final week of the month out to a full 7 cells so every
      // column — including this month's last one — is a complete column.
      const trailingBlanks = (7 - (flat.length % 7)) % 7;
      for (let i = 0; i < trailingBlanks; i++) flat.push(null);

      for (let i = 0; i < flat.length; i += 7) {
        cols.push(flat.slice(i, i + 7));
      }
    }
    return cols;
  }, [activity]);

  const monthLabels = useMemo(() => {
    // Each month's day-1 cell always falls in the first column of its
    // block (leadingBlanks is 0–6, so day 1 is always within the first
    // 7-cell chunk) — labeling whichever column contains a "day 1" cell
    // is exactly that month's start column, with no index bookkeeping
    // needed during the build above.
    return weeks.map((col) => {
      const firstOfMonth = col.find((cell) => cell && cell.date.getDate() === 1) as DayCell | undefined;
      return firstOfMonth ? firstOfMonth.date.toLocaleDateString("en-US", { month: "short" }) : null;
    });
  }, [weeks]);

  if (!activity) {
    return (
      <Card>
        <div className="relative h-40">
          <SpinnerLoader />
        </div>
      </Card>
    );
  }

  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  const slides: { label: string; line1: string; line2: string }[] = [
    { label: "Current streak", line1: `${days(stats.currentStreak)} in a row.`, line2: stats.currentStreak > 0 ? "Keep it going today." : "Read today to start a new streak." },
    { label: "Longest streak", line1: `Longest streak: ${days(stats.longestStreak)}.`, line2: stats.longestStreak > stats.currentStreak ? "Can you beat it?" : "You are on your best run." },
    { label: "Active days", line1: `${stats.totalActiveDays} active ${stats.totalActiveDays === 1 ? "day" : "days"}.`, line2: "Every square below is a day you showed up." },
    { label: "Total reading time", line1: `${formatShortDuration(stats.totalMinutes * 60_000)} of reading.`, line2: "Across every story you have read." },
  ];
  const current = slides[slide];

  const gridTemplateColumns = `repeat(${weeks.length}, ${CELL_PX}px)`;

  return (
    <section aria-label="Consistency">
      <div className="mb-4 flex items-baseline justify-between gap-3 px-1">
        <h3 className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">Consistency.</h3>
        <span className="shrink-0 text-sm sm:text-base" style={{ color: BRAND_BLUE }}>Last {MONTHS_TO_SHOW} months</span>
      </div>
      <div className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-4 pb-8 pt-8 sm:px-10 sm:pt-12">
      <motion.div key={slide} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto max-w-xl text-center" aria-live="polite">
        <p className="font-display text-2xl leading-[1.15] tracking-[-0.03em] text-ink sm:text-4xl">{current.line1}</p>
        <p className="mt-1 font-display text-2xl leading-[1.15] tracking-[-0.03em] text-ink-muted sm:text-4xl">{current.line2}</p>
      </motion.div>

      <div className="mt-8 flex justify-center">
        <div className="max-w-full">
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-2">
          {/* Month labels — same grid template + gap as the day grid below,
              so column i here is guaranteed to sit exactly above column i
              of the day cells (see the alignment-fix note above). */}
          <div className="grid" style={{ gridTemplateColumns, columnGap: GAP_PX }}>
            {monthLabels.map((label, wi) => (
              <div key={wi} className="relative h-4 overflow-visible whitespace-nowrap text-xs text-ink-muted">
                {label && <span className="absolute left-0">{label}</span>}
              </div>
            ))}
          </div>

          {/* Day grid — one column per week, 7 rows per column. */}
          <div className="grid" style={{ gridTemplateColumns, columnGap: GAP_PX }}>
            {weeks.map((col, wi) => (
              <div key={wi} className="grid" style={{ gridTemplateRows: `repeat(7, ${CELL_PX}px)`, rowGap: GAP_PX }}>
                {col.map((cell, ci) => {
                  if (!cell) {
                    // Structural blank — month-start/month-end padding,
                    // never a real date. No color, no border, no
                    // interaction, so it reads as true empty space.
                    return <div key={`blank-${wi}-${ci}`} style={{ width: CELL_PX, height: CELL_PX }} />;
                  }
                  if (cell.isFuture) {
                    return (
                      <div
                        key={cell.key}
                        aria-hidden
                        className="rounded-[2px] border border-dashed border-overlay/10"
                        style={{ width: CELL_PX, height: CELL_PX }}
                      />
                    );
                  }
                  const level = levelFor(cell.entry);
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      aria-label={tooltipLines(cell).join(", ")}
                      style={{ width: CELL_PX, height: CELL_PX }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHovered({ day: cell, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHovered({ day: cell, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onBlur={() => setHovered(null)}
                      className={`rounded-[2px] ${LEVEL_CLASS[level]} transition-transform duration-150 hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-medium ${
                        cell.isToday ? "ring-2 ring-ink/70 ring-offset-1 ring-offset-canvas" : ""
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
        <span>No activity</span>
        {([0, 1, 2, 3] as Level[]).map((l) => (
          <span key={l} className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_CLASS[l]}`} title={LEVEL_LABEL[l]} />
        ))}
        <span>High</span>
      </div>

      </div>
      <PagerPill count={slides.length} index={slide} onSelect={setSlide} labels={slides.map((x) => x.label)} />

      {hovered && (
        <div
          role="tooltip"
          className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-pre-line ${HOVER_CARD_CLASS}`}
          style={{ left: hovered.x, top: hovered.y - 8 }}
        >
          {tooltipLines(hovered.day).map((line, i) => (
            <div key={i} className={i === 0 ? "mb-1 font-display text-base tracking-[-0.02em] text-ink" : "text-ink-muted"}>
              {line}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
