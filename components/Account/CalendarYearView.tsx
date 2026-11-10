"use client";

import React from "react";

/** The whole year at a glance: twelve small months. Click a day to open it, click a month name to open that month. */
interface YearEvent { start: Date; end: Date }
interface YearViewProps {
  date: Date;
  events: YearEvent[];
  localizer: { startOfWeek: (culture?: string) => number; format: (d: Date, fmt: string, culture?: string) => string };
  culture?: string;
  onDrillDown: (date: Date, view?: string) => void;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function YearViewImpl({ date, events, localizer, culture, onDrillDown }: YearViewProps) {
  const year = date.getFullYear();
  const first = localizer.startOfWeek(culture) || 0;

  // Every day that has at least one event on it.
  const busy = new Set<string>();
  for (const e of events) {
    const d = new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate());
    const last = new Date(e.end.getFullYear(), e.end.getMonth(), e.end.getDate());
    // An event that ends exactly at midnight does not touch that last day.
    if (e.end.getHours() === 0 && e.end.getMinutes() === 0 && last > d) last.setDate(last.getDate() - 1);
    for (let guard = 0; d <= last && guard < 400; guard += 1) { busy.add(dayKey(d)); d.setDate(d.getDate() + 1); }
  }
  const today = dayKey(new Date());

  return (
    <div className="pw-year">
      {Array.from({ length: 12 }, (_, m) => {
        const startOfMonth = new Date(year, m, 1);
        const lead = (startOfMonth.getDay() - first + 7) % 7;
        const days = new Date(year, m + 1, 0).getDate();
        const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
        return (
          <div key={m} className="pw-year__month">
            <button type="button" className="pw-year__name" onClick={() => onDrillDown(startOfMonth, "month")}>
              {localizer.format(startOfMonth, "MMMM", culture)}
            </button>
            <div className="pw-year__grid">
              {Array.from({ length: 7 }, (_, i) => <span key={`h${i}`} className="pw-year__dow">{WEEKDAYS[(first + i) % 7]}</span>)}
              {cells.map((d, i) => {
                if (d === null) return <span key={`e${i}`} />;
                const cell = new Date(year, m, d);
                const k = dayKey(cell);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onDrillDown(cell, "day")}
                    className={`pw-year__day${k === today ? " is-today" : ""}${busy.has(k) ? " has-events" : ""}`}
                    aria-label={`${localizer.format(cell, "dddd D MMMM YYYY", culture)}${busy.has(k) ? ", has events" : ""}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Static members react-big-calendar asks every custom view for. */
export const YearView = Object.assign(YearViewImpl, {
  range: (date: Date) => [new Date(date.getFullYear(), 0, 1), new Date(date.getFullYear(), 11, 31)],
  navigate: (date: Date, action: string) => {
    const d = new Date(date);
    if (action === "PREV") d.setFullYear(d.getFullYear() - 1);
    else if (action === "NEXT") d.setFullYear(d.getFullYear() + 1);
    else if (action === "TODAY") return new Date();
    return d;
  },
  title: (date: Date) => String(date.getFullYear()),
});
