"use client";

import React, { useEffect, useState } from "react";
import { inertiaScrollTo } from "@/components/ReadingMode/useInertiaScroll";

const MAX_TICKS = 5;

interface Item { id: number; title: string; y: number }

/**
 * Replaces the native scrollbar: a column of short dashes on the left edge
 * (one per section), the current one longer and darker. Hovering opens the
 * section list; clicking a dash glides to that section.
 */
export function ScrollRail({ bodyRef, deps, side = "left", accent, alwaysOpen = false }: { bodyRef: React.RefObject<HTMLElement>; deps: unknown; side?: "left" | "right"; accent?: string; alwaysOpen?: boolean }) {
  const right = side === "right";
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  // alwaysOpen: the section list stays shown (on wide screens) until a dash is clicked, which hides/shows it.
  const [listOpen, setListOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      const heads: HTMLElement[] = Array.from(body.querySelectorAll<HTMLElement>("h1, h2, h3"));
      const marked: HTMLElement[] = Array.from(body.querySelectorAll<HTMLElement>("[data-rail-title]"));
      let els: Array<{ el: HTMLElement; title: string }>;
      if (marked.length >= 2) els = marked.map((el: HTMLElement) => ({ el, title: el.dataset.railTitle || "Section" }));
      else if (heads.length >= 3) els = heads.map((el: HTMLElement) => ({ el, title: el.textContent?.trim() || "Section" }));
      else {
        const blocks = Array.from(body.children).filter((c): c is HTMLElement => c instanceof HTMLElement && !!c.textContent?.trim());
        const step = Math.max(1, Math.ceil(blocks.length / 9));
        els = blocks.filter((_, i) => i % step === 0).map((el) => ({ el, title: (el.textContent ?? "").trim().slice(0, 48) || "Section" }));
      }
      setItems(els.map(({ el, title }: { el: HTMLElement; title: string }, id: number) => ({ id, title, y: el.getBoundingClientRect().top + window.scrollY })));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
  }, [bodyRef, deps]);

  useEffect(() => {
    if (!items.length) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.scrollY + window.innerHeight * 0.35;
      let idx = 0;
      items.forEach((it, i) => { if (it.y <= line) idx = i; });
      setActive(idx);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [items]);

  if (items.length < 2) return null;
  // At most 5 dashes, whatever the number of sections; each stands for a run of sections.
  const ticks = Math.min(MAX_TICKS, items.length);
  const groupStart = (k: number) => Math.round((k * items.length) / ticks);
  const activeTick = Math.min(ticks - 1, Math.floor((active * ticks) / items.length));
  const go = (y: number) => inertiaScrollTo(Math.max(0, y - 96));

  return (
    <nav aria-label="Sections" className={`group fixed top-1/2 z-30 -translate-y-1/2 ${right ? "right-1 sm:right-3" : "left-1 sm:left-3"}`}>
      <ul className={`flex flex-col gap-0 py-3 ${right ? "items-end pl-5 pr-1 sm:pl-6 sm:pr-2" : "pl-1 pr-5 sm:pl-2 sm:pr-6"}`}>
        {Array.from({ length: ticks }, (_, k) => (
          <li key={k}>
            <button onClick={() => { go(items[groupStart(k)].y); if (alwaysOpen) setListOpen((v) => !v); }} aria-label={`Go to ${items[groupStart(k)].title}`} aria-current={k === activeTick} className={`flex h-3.5 w-6 items-center sm:w-8 ${right ? "justify-end" : ""}`}>
              <span style={k === activeTick && accent ? { backgroundColor: accent } : undefined} className={`block h-[2px] rounded-full transition-all duration-200 ${k === activeTick ? `w-5 sm:w-6 ${accent ? "" : "bg-ink"}` : "w-3 bg-ink-faint/70 hover:bg-ink-muted sm:w-4"}`} />
            </button>
          </li>
        ))}
      </ul>
      <div className={`${alwaysOpen && listOpen ? "" : "pointer-events-none"} absolute top-1/2 w-[min(16rem,calc(100vw-3.5rem))] -translate-y-1/2 rounded-xl border border-overlay/10 bg-canvas-raised/95 p-2 shadow-themed backdrop-blur-xl transition-opacity duration-150 ${alwaysOpen ? (listOpen ? "pointer-events-auto opacity-100" : "opacity-0") : "opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"} ${right ? "right-8 sm:right-10" : "left-8 sm:left-10"}`}>
        <ul className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {items.map((it, i) => (
            <li key={it.id}>
              <button onClick={() => go(it.y)} className={`block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-overlay/5 ${i === active ? "bg-overlay/5 text-ink" : "text-ink-muted"}`}>
                {it.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
