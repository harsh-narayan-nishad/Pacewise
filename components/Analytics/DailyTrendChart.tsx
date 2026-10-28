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
  ReferenceDot,
  Dot,
} from "recharts";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { PagerPill } from "@/components/Analytics/PagerPill";
import { BRAND_BLUE } from "@/lib/brand";
import { HOVER_CARD_CLASS } from "@/lib/chartStyle";
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
  const [slide, setSlide] = useState(-1); // -1 = the latest plotted day

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

  // The pager steps through the most recent days; the chart highlights the one in view.
  const recent = points.slice(-6);
  const activeIdx = slide < 0 || slide >= recent.length ? recent.length - 1 : slide;
  const active = recent[activeIdx];
  const prevOfActive = points[points.length - recent.length + activeIdx - 1];
  const delta = prevOfActive ? active.effectiveWpm - prevOfActive.effectiveWpm : null;

  return (
    <section aria-label="Daily pace" className="min-w-0">
      <div className="mb-4 flex items-baseline justify-between gap-3 px-1">
        <h3 className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">Daily pace.</h3>
        <span className="shrink-0 text-sm sm:text-base" style={{ color: BRAND_BLUE }}>
          Average {average} wpm
        </span>
      </div>
      <div className="min-w-0 rounded-[32px] border border-overlay/10 bg-canvas-raised px-4 pb-8 pt-8 sm:px-10 sm:pt-12">
        <motion.div key={activeIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto max-w-xl text-center" aria-live="polite">
          <p className="font-display text-2xl leading-[1.15] tracking-[-0.03em] text-ink sm:text-4xl">
            {active.label}. {active.effectiveWpm} wpm.
          </p>
          <p className="mt-1 font-display text-2xl leading-[1.15] tracking-[-0.03em] text-ink-muted sm:text-4xl">
            {delta === null ? "Your first plotted day." : delta === 0 ? "Same as the day before." : `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} from the day before.`}
          </p>
        </motion.div>

        <div className="mt-8">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={points} margin={{ top: 10, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgb(var(--overlay) / 0.08)" />
              <XAxis dataKey="label" stroke="rgb(var(--ink-muted))" fontSize={11} tickMargin={8} tickLine={false} axisLine={false} />
              <YAxis stroke="rgb(var(--ink-muted))" fontSize={11} width={40} tickMargin={6} allowDecimals={false} tickLine={false} axisLine={false} />
              <ReferenceLine y={average} stroke="rgb(var(--ink-muted))" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Tooltip content={<TrendTooltip />} />
              <Line type="monotone" dataKey="effectiveWpm" stroke="rgb(var(--ink-muted))" strokeWidth={2} dot={renderDot} activeDot={{ r: 6 }} />
              <ReferenceDot x={active.label} y={active.effectiveWpm} r={9} fill="none" stroke={BRAND_BLUE} strokeWidth={2} ifOverflow="extendDomain" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <PagerPill count={recent.length} index={activeIdx} onSelect={setSlide} labels={recent.map((p) => p.label)} />
    </section>
  );
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p: TrendPoint = payload[0].payload;
  return (
    <div className={HOVER_CARD_CLASS}>
      <div className="mb-1 font-display text-base tracking-[-0.02em] text-ink">{p.label}</div>
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
