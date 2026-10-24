"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/card";
import { ReadingHistoryEntry } from "@/types";
import { ContributionHeatmap } from "@/components/Analytics/ContributionHeatmap";
import { DailyTrendChart } from "@/components/Analytics/DailyTrendChart";
import { EfficiencyTrends } from "@/components/Analytics/EfficiencyTrends";

interface AnalyticsProps {
  history: ReadingHistoryEntry[];
}

/**
 * Recharts is loaded eagerly here since Analytics only mounts on the
 * results/history view, not the reading screen — keeps the charting
 * bundle off the latency-critical auto-scroll path. In a real deployment
 * this component would additionally be wrapped in `next/dynamic` with
 * `ssr: false` to defer the parse cost until it's actually rendered.
 */
export function Analytics({ history }: AnalyticsProps) {
  if (history.length === 0) {
    return (
      <Card className="text-sm text-ink-muted">
        No reading history yet — finish a session to see your trends here.
      </Card>
    );
  }

  const chartData = [...history]
    .reverse()
    .map((h, i) => ({ session: i + 1, wpm: h.wpm, accuracy: h.accuracy }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="min-w-0">
          <div className="mb-3 text-sm text-ink-muted">Reading speed over time</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--overlay) / 0.08)" />
              <XAxis dataKey="session" stroke="rgb(var(--ink-muted))" fontSize={12} />
              <YAxis stroke="rgb(var(--ink-muted))" fontSize={12} width={44} tickMargin={6} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "rgb(var(--canvas-raised))",
                  border: "1px solid rgb(var(--overlay) / 0.1)",
                  color: "rgb(var(--ink))",
                }}
                labelStyle={{ color: "rgb(var(--ink-muted))" }}
              />
              <Line type="monotone" dataKey="wpm" stroke="#7FC97F" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="min-w-0">
          <div className="mb-3 text-sm text-ink-muted">Accuracy over time</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--overlay) / 0.08)" />
              <XAxis dataKey="session" stroke="rgb(var(--ink-muted))" fontSize={12} />
              <YAxis stroke="rgb(var(--ink-muted))" fontSize={12} domain={[0, 100]} width={44} tickMargin={6} />
              <Tooltip
                contentStyle={{
                  background: "rgb(var(--canvas-raised))",
                  border: "1px solid rgb(var(--overlay) / 0.1)",
                  color: "rgb(var(--ink))",
                }}
                labelStyle={{ color: "rgb(var(--ink-muted))" }}
              />
              <Line type="monotone" dataKey="accuracy" stroke="#5FA8D3" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

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
