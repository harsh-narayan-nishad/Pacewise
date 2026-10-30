"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BRAND_BLUE } from "@/lib/brand";

interface Target { href: string; title: string }
interface Mark { id: string; text: string; level: number }

/** Round icon-only link; the page it leads to shows on hover or keyboard focus. */
function PagerButton({ target, side }: { target: Target; side: "prev" | "next" }) {
  const Icon = side === "prev" ? ArrowLeft : ArrowRight;
  return (
    <Link
      href={target.href}
      aria-label={`${side === "prev" ? "Previous" : "Next"}: ${target.title}`}
      className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-overlay/10 bg-canvas-raised text-ink transition-colors hover:bg-overlay/10 focus-visible:bg-overlay/10"
    >
      <Icon className={`h-5 w-5 transition-transform ${side === "prev" ? "group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`} />
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full mb-2 max-w-[70vw] whitespace-nowrap rounded-xl border border-overlay/10 bg-canvas-raised px-3 py-1.5 text-sm text-ink opacity-0 shadow-themed transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${side === "prev" ? "left-0" : "right-0"}`}
      >
        <span className="block text-[10px] font-medium uppercase tracking-wide text-ink-muted">{side === "prev" ? "Previous" : "Next"}</span>
        <span className="block max-w-[60vw] truncate">{target.title}</span>
      </span>
    </Link>
  );
}

/**
 * Document pages. A column of short bar lines on the right edge (one per heading, the current one lit
 * in blue; hover for its name, click to jump), and icon-only Previous / Next buttons placed after the
 * ending content of the page.
 */
export function DocNav({ prev, next }: { prev?: Target; next?: Target }) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const found = Array.from(document.querySelectorAll<HTMLElement>(".doc-prose h2[id], .doc-prose h3[id]"))
      .map((el) => ({ id: el.id, text: el.textContent?.trim() ?? "", level: Number(el.tagName[1]) }));
    // Very long pages: keep only the main headings so the column stays short.
    setMarks(found.length > 28 ? found.filter((m) => m.level === 2) : found);
  }, []);

  useEffect(() => {
    if (marks.length === 0) return;
    const onScroll = () => {
      let idx = 0;
      marks.forEach((m, i) => {
        const el = document.getElementById(m.id);
        if (el && el.getBoundingClientRect().top <= 140) idx = i;
      });
      setActive(idx);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [marks]);

  return (
    <>
      {marks.length > 1 && (
        <nav aria-label="Sections on this page" className="fixed right-4 top-1/2 z-[90] hidden -translate-y-1/2 flex-col items-end md:flex">
          {marks.map((m, i) => (
            <a
              key={m.id}
              href={`#${m.id}`}
              aria-label={m.text}
              aria-current={i === active ? "true" : undefined}
              className="group relative flex h-[14px] items-center justify-end pl-3"
            >
              <span
                role="tooltip"
                className="pointer-events-none absolute right-full mr-2 max-w-[60vw] truncate whitespace-nowrap rounded-xl border border-overlay/10 bg-canvas-raised px-3 py-1.5 text-sm text-ink opacity-0 shadow-themed transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {m.text}
              </span>
              <span
                className="block h-[3px] rounded-full transition-all"
                style={{ width: i === active ? 26 : m.level === 2 ? 18 : 10, background: i === active ? BRAND_BLUE : i < active ? "rgb(var(--ink) / 0.55)" : "rgb(var(--ink) / 0.22)" }}
              />
            </a>
          ))}
        </nav>
      )}
      {(prev || next) && (
        <nav aria-label="Previous and next page" className="mt-16 flex items-center justify-between border-t border-overlay/10 pt-6">
          {prev ? <PagerButton target={prev} side="prev" /> : <span />}
          {next ? <PagerButton target={next} side="next" /> : <span />}
        </nav>
      )}
    </>
  );
}
