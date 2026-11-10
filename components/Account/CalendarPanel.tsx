"use client";

import React, { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import moment from "moment";
import { Calendar, momentLocalizer, Views, type CalendarProps, type SlotInfo, type View } from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./CalendarPanel.css";
import { YearView } from "@/components/Account/CalendarYearView";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import { addEvent, changeEvent, loadEvents, removeEvent } from "@/lib/calendar/events";
import type { CalendarVariant } from "@/lib/api/endpoints";

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  variant: CalendarVariant;
}

const DnDCalendar = withDragAndDrop<CalEvent>(Calendar as unknown as ComponentType<CalendarProps<CalEvent>>);
const localizer = momentLocalizer(moment);

const FIELD = "h-12 w-full rounded-xl border border-overlay/20 bg-transparent px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink/60";
const LABEL = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted";

/** "YYYY-MM-DDTHH:mm" in the viewer's own time zone, as a datetime-local input wants it. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const VIEWS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

type Draft = { id?: string; title: string; start: string; end: string; variant: CalendarVariant; allDay: boolean };

/** The Calendar tab of the profile: week / day / month / agenda views, drag to move, drag the edge to resize. */
export function CalendarPanel() {
  const user = useCurrentUser();
  const userId = user?.id ?? null;
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  // "year" is our own view (see CalendarYearView); the rest are the built-in ones.
  const [view, setView] = useState<string>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadEvents(userId).then((rows) => {
      if (cancelled) return;
      setEvents(rows.map((r) => ({ ...r, start: new Date(r.start), end: new Date(r.end) })));
    });
    return () => { cancelled = true; };
  }, [userId]);

  const openNew = useCallback((start: Date, end: Date, allDay = false) => {
    setError(null);
    setDraft({ title: "", start: toLocalInput(start), end: toLocalInput(end), variant: "primary", allDay });
  }, []);

  const onSelectSlot = (slot: SlotInfo) => {
    const sameInstant = slot.end.getTime() === slot.start.getTime();
    // Picking whole days in the month view gives midnight-to-midnight: treat that as an all-day event.
    const wholeDays = !sameInstant && slot.start.getHours() === 0 && slot.start.getMinutes() === 0 && slot.end.getHours() === 0 && slot.end.getMinutes() === 0;
    openNew(slot.start, sameInstant ? new Date(slot.start.getTime() + 60 * 60 * 1000) : slot.end, wholeDays);
  };

  const onSelectEvent = (e: CalEvent) => {
    setError(null);
    setDraft({ id: e.id, title: e.title, start: toLocalInput(e.start), end: toLocalInput(e.end), variant: e.variant, allDay: e.allDay });
  };

  const patchLocal = (id: string, patch: Partial<CalEvent>) => setEvents((list) => (list ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)));

  // Drag to move / drag the edge to resize: update the screen at once, then save.
  const onMoveOrResize = ({ event, start, end, isAllDay }: EventInteractionArgs<CalEvent>) => {
    if (!userId) return;
    const s = new Date(start);
    const e = new Date(end);
    const allDay = typeof isAllDay === "boolean" ? isAllDay : event.allDay;
    patchLocal(event.id, { start: s, end: e, allDay });
    void changeEvent(userId, event.id, { start: s.toISOString(), end: e.toISOString(), allDay });
  };

  const save = async () => {
    if (!draft || !userId) return;
    const title = draft.title.trim();
    const start = new Date(draft.start);
    const end = new Date(draft.end);
    if (!title) return setError("Give the event a title.");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return setError("Choose a start and an end time.");
    if (end.getTime() < start.getTime()) return setError("The end must not be before the start.");
    const payload = { title, start: start.toISOString(), end: end.toISOString(), allDay: draft.allDay, variant: draft.variant };
    if (draft.id) {
      patchLocal(draft.id, { title, start, end, allDay: draft.allDay, variant: draft.variant });
      void changeEvent(userId, draft.id, payload);
    } else {
      const created = await addEvent(userId, payload);
      setEvents((list) => [...(list ?? []), { ...created, start: new Date(created.start), end: new Date(created.end) }]);
    }
    setDraft(null);
  };

  const remove = async () => {
    if (!draft?.id || !userId) return;
    const id = draft.id;
    setEvents((list) => (list ?? []).filter((e) => e.id !== id));
    setDraft(null);
    await removeEvent(userId, id);
  };

  // Apple-style title: the month in bold, the year light.
  const titleParts = useMemo(() => {
    const m = moment(date);
    if (view === "year") return { bold: m.format("YYYY"), light: "" };
    if (view === "day") return { bold: m.format("D MMMM"), light: m.format("YYYY") };
    return { bold: m.format("MMMM"), light: m.format("YYYY") };
  }, [date, view]);
  const go = (n: number) => setDate(moment(date).add(n, view === "day" ? "day" : view === "week" ? "week" : view === "year" ? "year" : "month").toDate());

  const eventPropGetter = useMemo<NonNullable<CalendarProps<CalEvent>["eventPropGetter"]>>(() => (e) => ({ className: `event-variant-${e.variant}` }), []);

  return (
    <>
      <Card className="rounded-[32px] bg-canvas-raised p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button type="button" aria-label="New event" onClick={() => { const s = new Date(); s.setMinutes(0, 0, 0); openNew(s, new Date(s.getTime() + 60 * 60 * 1000)); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-overlay/[0.07] text-ink transition-colors hover:bg-overlay/[0.12]">
            <Plus className="h-4 w-4" />
          </button>
          <div role="tablist" aria-label="Calendar view" className="flex rounded-full bg-overlay/[0.07] p-1">
            {VIEWS.map(({ id, label }) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${view === id ? "bg-overlay/[0.14] text-ink" : "text-ink-muted hover:text-ink"}`}>{label}</button>
            ))}
          </div>
          <span className="w-9" aria-hidden />
        </div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h3 className="font-display text-3xl tracking-[-0.02em] text-ink sm:text-4xl">
            <span className="font-semibold">{titleParts.bold}</span>{titleParts.light && <span className="font-light text-ink-muted"> {titleParts.light}</span>}
          </h3>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Previous" onClick={() => go(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-overlay/[0.07] text-ink transition-colors hover:bg-overlay/[0.12]"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setDate(new Date())} className="h-8 rounded-full bg-overlay/[0.07] px-3.5 text-sm font-medium text-ink transition-colors hover:bg-overlay/[0.12]">Today</button>
            <button type="button" aria-label="Next" onClick={() => go(1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-overlay/[0.07] text-ink transition-colors hover:bg-overlay/[0.12]"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="pw-calendar">
          <DnDCalendar
            localizer={localizer}
            style={{ height: 680, width: "100%" }}
            selectable
            resizable
            date={date}
            onNavigate={setDate}
            view={view as View}
            onView={(v) => setView(v)}
            toolbar={false}
            views={{ day: true, week: true, month: true, year: YearView } as never}
            onDrillDown={(d: Date, v?: string) => { setDate(d); setView(v ?? Views.DAY); }}
            events={events ?? []}
            eventPropGetter={eventPropGetter}
            draggableAccessor={() => true}
            resizableAccessor={() => true}
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
            onEventDrop={onMoveOrResize}
            onEventResize={onMoveOrResize}
          />
        </div>
      </Card>

      {draft && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setDraft(null); }}>
          <div role="dialog" aria-modal="true" aria-label={draft.id ? "Edit event" : "New event"} className="w-full max-w-md rounded-[28px] border border-overlay/10 bg-canvas-raised p-6 shadow-themed sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-2xl tracking-[-0.02em] text-ink">{draft.id ? "Edit event" : "New event"}</h3>
              <button type="button" aria-label="Close" onClick={() => setDraft(null)} className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-4">
              <label className="block"><span className={LABEL}>Title</span>
                <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} placeholder="Event title" className={FIELD} />
              </label>
              <label className="block"><span className={LABEL}>Style</span>
                <select value={draft.variant} onChange={(e) => setDraft({ ...draft, variant: e.target.value as CalendarVariant })} className={FIELD}>
                  <option value="primary">Blue</option>
                  <option value="secondary">Purple</option>
                  <option value="outline">Outline</option>
                </select>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block"><span className={LABEL}>Starts</span>
                  <input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={FIELD} />
                </label>
                <label className="block"><span className={LABEL}>Ends</span>
                  <input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={FIELD} />
                </label>
              </div>
              {error && <p role="alert" className="text-sm text-accent-extreme">{error}</p>}
              <div className="mt-1 flex items-center justify-between gap-2">
                {draft.id ? <Button type="button" variant="outline" onClick={() => void remove()}>Delete</Button> : <span />}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                  <Button type="submit">{draft.id ? "Save" : "Create"}</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
