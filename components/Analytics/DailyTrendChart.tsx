"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Dot,
} from "recharts";
import { Card } from "@/components/ui/card";
import { DailyActivity, storage } from "@/lib/storage";
import { formatShortDuration } from "@/lib/wpmCalculator";
import SpinnerLoader from "@/components/ui/loaders/SpinnerLoader";

interface TrendPoint {
  dateKey: string;
  label: string;
  effectiveWpm: number;
  attempts: number;
  minutes: number;
}

/**
 * A second tracking chart, distinct from the calendar: where the
 * heatmap answers "which days was I active," this answers "how is my
 * pace trending session to session" — modeled on a Codeforces contest
 * rating graph. Only days with an actual attempt become a point (an
 * inactive day isn't plotted as a dip to zero, the same way a contest
 * graph has no point for a contest you didn't enter), points are
 * connected in chronological order, and each dot is colored green/red
 * depending on whether that day's pace improved or dropped versus the
 * previous plotted day — the same "up good, down bad" read as a rating
 * graph, applied to effective WPM instead of a rating number.
 */
export function DailyTrendChart() {
  const [activity, setActivity] = useState<Record<string, DailyActivity> | null>(null);

  useEffect(() => {
    setActivity(storage.getDailyActivity());
  }, []);

  const points = useMemo<TrendPoint[]>(() => {
    if (!activity) return [];
    return Object.values(activity)
      .filter((d) => d.effectiveWpmSamples > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        // Parse "YYYY-MM-DD" via explicit local components rather than
        // `new Date(d.date)`, which JS parses as UTC midnight and can
        // display as the *previous* local day west of UTC.
        const [y, m, day] = d.date.split("-").map(Number);
        const localDate = new Date(y, m - 1, day);
        return {
          dateKey: d.date,
          label: localDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          effectiveWpm: Math.round(d.effectiveWpmSum / d.effectiveWpmSamples),
          attempts: d.sessions,
          minutes: d.minutes,
        };
      });
  }, [activity]);

  const average = useMemo(
    () => (points.length ? Math.round(points.reduce((s, p) => s + p.effectiveWpm, 0) / points.length) : 0),
    [points]
  );

  if (!activity) {
    return (
      <Card>
        <div className="relative h-56">
          <SpinnerLoader />
        </div>
      </Card>
    );
  }

  if (points.length < 2) {
    return (
      <Card>
        <div className="mb-1 text-sm text-ink-muted">Daily pace fluctuation</div>
        <p className="text-sm text-ink-muted">
          Read on a couple more days to see how your pace trends day to day, contest-graph style.
        </p>
      </Card>
    );
  }

  const renderDot = (props: any) => {
    const { cx, cy, index } = props;
    const curr = points[index];
    const prev = index > 0 ? points[index - 1] : null;
    const color = !prev
      ? "rgb(var(--ink-muted))"
      : curr.effectiveWpm >= prev.effectiveWpm
      ? "#7FC97F" // accent-medium — pace held or improved vs. the previous session
      : "#E05B5B"; // accent-extreme — pace dropped vs. the previous session
    return <Dot key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={color} stroke="rgb(var(--canvas))" strokeWidth={1.5} />;
  };

  return (
    <Card className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-sm text-ink-muted">Daily pace fluctuation</div>
        <div className="text-xs text-ink-muted">
          Avg <span className="font-mono text-ink">{average}</span> wpm
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ top: 10, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--overlay) / 0.08)" />
          <XAxis dataKey="label" stroke="rgb(var(--ink-muted))" fontSize={11} tickMargin={8} />
          <YAxis stroke="rgb(var(--ink-muted))" fontSize={11} width={40} tickMargin={6} allowDecimals={false} />
          <ReferenceLine y={average} stroke="rgb(var(--ink-muted))" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="effectiveWpm"
            stroke="rgb(var(--ink-muted))"
            strokeWidth={2}
            dot={renderDot}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p: TrendPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-overlay/10 bg-canvas-raised px-3 py-2 text-xs shadow-themed">
      <div className="mb-1 font-medium text-ink">{p.label}</div>
      <div className="text-ink-muted">
        Effective WPM: <span className="text-ink">{p.effectiveWpm}</span>
      </div>
      <div className="text-ink-muted">
        Attempts: <span className="text-ink">{p.attempts}</span>
      </div>
      <div className="text-ink-muted">
        Reading time: <span className="text-ink">{formatShortDuration(p.minutes * 60_000)}</span>
      </div>
    </div>
  );
}
