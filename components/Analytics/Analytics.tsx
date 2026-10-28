"use client";

import React from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/card";
import { BRAND_BLUE } from "@/lib/brand";
import { CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_STYLE } from "@/lib/chartStyle";
import { ReadingHistoryEntry } from "@/types";
import { ContributionHeatmap } from "@/components/Analytics/ContributionHeatmap";
import { DailyTrendChart } from "@/components/Analytics/DailyTrendChart";
import { EfficiencyTrends } from "@/components/Analytics/EfficiencyTrends";

interface AnalyticsProps {
  history: ReadingHistoryEntry[];
  /** The results page shows the speed / accuracy tiles itself, in its own tile grid. */
  hideTrends?: boolean;
}

/**
 * Recharts is loaded eagerly here since Analytics only mounts on the
 * results/history view, not the reading screen — keeps the charting
 * bundle off the latency-critical auto-scroll path. In a real deployment
 * this component would additionally be wrapped in `next/dynamic` with
 * `ssr: false` to defer the parse cost until it's actually rendered.
 */
export function Analytics({ history, hideTrends = false }: AnalyticsProps) {
  if (history.length === 0) {
    return (
      <Card className="text-sm text-ink-muted">
        No reading history yet — finish a session to see your trends here.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!hideTrends && <TrendTiles history={history} />}

      {/* GitHub-style contribution graph, directly below the trend charts
          as requested. Self-contained (reads storage itself) so it
          doesn't need history piped through this component's props. */}
      <ContributionHeatmap />

      {/* Second tracking bar: a Codeforces-contest-style line graph of
          day-to-day pace fluctuation, distinct from the calendar's
          "which days was I active" view. */}
      <DailyTrendChart />

      <EfficiencyTrends />
    </div>
  );
}


interface MetricCardProps {
  title: string;
  caption: string;
  stat: string;
  data: { session: number; wpm: number | null; accuracy: number }[];
  dataKey: "wpm" | "accuracy";
  stroke: string;
  percent?: boolean;
  actions?: TileAction[];
}

/** One chart in the "iPad essentials" layout: big rounded card, centred title, a line of copy, a blue stat, the graph below. */
function MetricCard({ title, caption, stat, data, dataKey, stroke, percent, actions }: MetricCardProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[32px] border border-overlay/10 bg-canvas-raised px-4 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
      <h3 className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-4xl">{title}</h3>
      <p className="mt-2 text-base text-ink sm:text-lg">{caption}</p>
      <p className="mt-2 text-base sm:text-lg" style={{ color: BRAND_BLUE }}>{stat}</p>
      {actions && actions.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {actions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className={a.primary ? "rounded-full px-5 py-2 text-sm text-white transition-opacity hover:opacity-90" : "rounded-full border px-5 py-2 text-sm transition-colors hover:bg-overlay/5"}
              style={a.primary ? { background: BRAND_BLUE } : { borderColor: BRAND_BLUE, color: BRAND_BLUE }}
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-6">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgb(var(--overlay) / 0.08)" />
            <XAxis dataKey="session" stroke="rgb(var(--ink-muted))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="rgb(var(--ink-muted))" fontSize={12} width={44} tickMargin={6} allowDecimals={false} tickLine={false} axisLine={false} domain={percent ? [0, 100] : undefined} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            />
            <Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}


interface TileAction { label: string; href: string; primary?: boolean }

/** The speed and accuracy graphs as two tiles side by side (the apple.com home-page grid). */
export function TrendTiles({ history, actions }: { history: ReadingHistoryEntry[]; actions?: TileAction[] }) {
  const chartData = [...history]
    .reverse()
    .map((h, i) => ({ session: i + 1, wpm: h.wpm > 0 ? h.wpm : null, accuracy: h.accuracy }));

  const speeds = chartData.map((d) => d.wpm).filter((v): v is number => v !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((t, v) => t + v, 0) / xs.length) : 0);
  const lastSpeed = speeds[speeds.length - 1];
  const prevSpeed = speeds[speeds.length - 2];
  const accs = chartData.map((d) => d.accuracy);
  const lastAcc = accs[accs.length - 1];
  const prevAcc = accs[accs.length - 2];
  const trend = (last: number | undefined, prev: number | undefined, unit: string) =>
    last === undefined || prev === undefined ? "Keep reading to see your trend." : last === prev ? "Same as your previous session." : `${last > prev ? "Up" : "Down"} ${Math.abs(Math.round(last - prev))} ${unit} from your previous session.`;
  const speedCaption = speeds.length ? trend(lastSpeed, prevSpeed, "wpm") : "Read a story to see your speed.";
  const speedStat = speeds.length ? `Average ${avg(speeds)} wpm` : "No speed data yet";
  const accuracyCaption = trend(lastAcc, prevAcc, "points");
  const accuracyStat = `Average ${avg(accs)}%`;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MetricCard title="Reading speed" caption={speedCaption} stat={speedStat} data={chartData} dataKey="wpm" stroke="#7FC97F" actions={actions} />
      <MetricCard title="Accuracy" caption={accuracyCaption} stat={accuracyStat} data={chartData} dataKey="accuracy" stroke="#5FA8D3" percent actions={actions} />
    </div>
  );
}
