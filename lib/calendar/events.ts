import { calendarApi, type ApiCalendarEvent, type CalendarEventInput } from "@/lib/api/endpoints";
import { isApiEnabled } from "@/lib/api/config";
import { tokenStore } from "@/lib/api/tokenStore";

export type CalendarItem = ApiCalendarEvent;

/**
 * Calendar events for one person. Signed in with a backend: they live in MongoDB.
 * Without a backend (or if it cannot be reached) they are kept in this browser, so the calendar still works.
 */
const key = (userId: string) => `srt:calendar:${userId}`;
const online = () => isApiEnabled() && Boolean(tokenStore.getAccessToken());

function readLocal(userId: string): CalendarItem[] {
  try {
    const raw = window.localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as CalendarItem[]) : [];
  } catch { return []; }
}
function writeLocal(userId: string, items: CalendarItem[]): void {
  try { window.localStorage.setItem(key(userId), JSON.stringify(items)); } catch { /* storage full or blocked */ }
}
const localId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function loadEvents(userId: string): Promise<CalendarItem[]> {
  if (online()) {
    try { return await calendarApi.list(); } catch { /* fall back to this browser's copy */ }
  }
  return readLocal(userId);
}

export async function addEvent(userId: string, input: CalendarEventInput & { title: string; start: string; end: string }): Promise<CalendarItem> {
  if (online()) {
    try { return await calendarApi.create(input); } catch { /* keep it locally instead */ }
  }
  const item: CalendarItem = { id: localId(), allDay: false, variant: "primary", ...input };
  writeLocal(userId, [...readLocal(userId), item]);
  return item;
}

export async function changeEvent(userId: string, id: string, patch: CalendarEventInput): Promise<void> {
  if (online() && !id.startsWith("local-")) {
    try { await calendarApi.update(id, patch); return; } catch { /* fall through to the local copy */ }
  }
  writeLocal(userId, readLocal(userId).map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export async function removeEvent(userId: string, id: string): Promise<void> {
  if (online() && !id.startsWith("local-")) {
    try { await calendarApi.remove(id); return; } catch { /* fall through */ }
  }
  writeLocal(userId, readLocal(userId).filter((e) => e.id !== id));
}
