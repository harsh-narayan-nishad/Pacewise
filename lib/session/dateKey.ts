/** Local-time `YYYY-MM-DD` key — the one date-bucketing convention every
 *  per-day aggregate (calendar, trend charts, streaks) agrees on. */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
