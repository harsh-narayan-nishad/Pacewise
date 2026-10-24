/**
 * Google-History-style date bucketing, shared by every list in the app
 * that groups timestamped entries by day (Past Test Attempts, Search
 * History) — one implementation so "Today"/"Yesterday"/weekday/exact-date
 * labeling behaves identically everywhere instead of each screen rolling
 * its own slightly different version.
 */
export function dateBucketLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(
    undefined,
    sameYear ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" }
  );
}

/** Splits a (newest-first) list into [label, items] sections without
 *  re-sorting within a section — callers are expected to hand in
 *  already-ordered data. */
export function groupByDateBucket<T>(items: T[], getIso: (item: T) => string): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = dateBucketLabel(getIso(item));
    const bucket = groups.get(label);
    if (bucket) bucket.push(item);
    else groups.set(label, [item]);
  }
  return Array.from(groups.entries());
}
