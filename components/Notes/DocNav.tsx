"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BRAND_BLUE } from "@/lib/brand";
import { useDocsLang } from "@/lib/docs/lang";
import { ui } from "@/lib/docs/i18n";

interface Target { href: string; title: string }
interface Mark { id: string; text: string; level: number }

const LOADER_CSS = `
.dn-loader{position:relative;width:60px;height:30px;transform:scale(.6)}
.dn-ball{position:absolute;left:15%;width:8px;height:8px;border-radius:50%;background:currentColor;transform-origin:50%;animation:dn-bounce .5s alternate infinite ease}
.dn-ball:nth-child(2){left:45%;animation-delay:.2s}
.dn-ball:nth-child(3){left:auto;right:15%;animation-delay:.3s}
.dn-shadow{position:absolute;top:30px;left:15%;width:5px;height:4px;border-radius:50%;background:currentColor;opacity:.2;filter:blur(1px);transform-origin:50%;animation:dn-shadow .5s alternate infinite ease}
.dn-shadow:nth-child(5){left:45%;animation-delay:.2s}
.dn-shadow:nth-child(6){left:auto;right:15%;animation-delay:.3s}
@keyframes dn-bounce{0%{top:20px;height:5px;border-radius:50px 50px 25px 25px;transform:scaleX(1.7)}40%{height:8px;border-radius:50%;transform:scaleX(1)}100%{top:0}}
@keyframes dn-shadow{0%{transform:scaleX(1.5)}40%{transform:scaleX(1);opacity:.7}100%{transform:scaleX(.2);opacity:.4}}
@media (prefers-reduced-motion:reduce){.dn-ball,.dn-shadow{animation:none}}
`;

/** Three bouncing balls with shadows. Kept as an alternative loader (not used by the buttons right now). */
export function BallsLoader() {
  return (
    <span role="status" aria-label="Loading page" className="flex items-center justify-center">
      <style dangerouslySetInnerHTML={{ __html: LOADER_CSS }} />
      <span className="dn-loader" aria-hidden>
        <span className="dn-ball" />
        <span className="dn-ball" />
        <span className="dn-ball" />
        <span className="dn-shadow" />
        <span className="dn-shadow" />
        <span className="dn-shadow" />
      </span>
    </span>
  );
}

/*
 * Spinner with a little inertia. It starts from rest: the first 400 ms ease in (a quadratic curve,
 * 72 degrees in total) and then the steady spin takes over at 360 degrees per second. The ease-in ends
 * at 2 x 72 / 0.4 = 360 degrees per second, the steady speed, so there is no jump where they meet.
 */
const SPINNER_CSS = `
.dn-spinner{display:block;width:1.5rem;height:1.5rem;fill:none;stroke:currentColor;transform-origin:50% 50%;animation:dn-spin-up .4s cubic-bezier(.3333,0,.6667,.3333) forwards,dn-spin 1s linear .4s infinite}
@keyframes dn-spin-up{from{transform:rotate(0deg)}to{transform:rotate(72deg)}}
@keyframes dn-spin{from{transform:rotate(72deg)}to{transform:rotate(432deg)}}
@media (prefers-reduced-motion:reduce){.dn-spinner{animation:none}}
`;

/** Eight-spoke spinner with a soft start. Kept as an alternative loader (not used by the buttons right now). */
export function WheelSpinner() {
  const spokes: Array<[string, string, string, string]> = [
    ["128", "32", "128", "64"], ["195.9", "60.1", "173.3", "82.7"], ["224", "128", "192", "128"], ["195.9", "195.9", "173.3", "173.3"],
    ["128", "224", "128", "192"], ["60.1", "195.9", "82.7", "173.3"], ["32", "128", "64", "128"], ["60.1", "60.1", "82.7", "82.7"],
  ];
  return (
    <span role="status" aria-label="Loading page" className="flex items-center justify-center">
      <style dangerouslySetInnerHTML={{ __html: SPINNER_CSS }} />
      <svg className="dn-spinner" viewBox="0 0 256 256" aria-hidden>
        {spokes.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeLinecap="round" strokeLinejoin="round" strokeWidth={24} />
        ))}
      </svg>
    </span>
  );
}

/*
 * Twelve-tick spinner (the iOS look), one turn per second, ticks fading round the dial. The ticks use
 * Apple's system gray (#8E8E93) rather than the text colour, so it stays quiet on every theme. It fades in over
 * 200 ms (the iOS default fade) when it appears.
 */
const TICK_CSS = `
.dn-ticks{position:relative;width:54px;height:54px;transform:scale(.5);animation:dn-fade-in .2s ease-out both}
.dn-tick{position:absolute;left:46%;top:38%;width:8%;height:24%;border-radius:50px;background:rgb(142,142,147);opacity:0;animation:dn-tick-fade 1s linear infinite}
@keyframes dn-tick-fade{from{opacity:1}to{opacity:.2}}
@keyframes dn-fade-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.dn-tick{animation:none;opacity:.6}}
`;

/** Twelve-tick spinner shown in place of the arrow while the next page loads (no text). */
function TickSpinner() {
  return (
    <span role="status" aria-label="Loading page" className="flex h-7 w-7 items-center justify-center">
      <style dangerouslySetInnerHTML={{ __html: TICK_CSS }} />
      <span className="dn-ticks" aria-hidden style={{ flex: "none" }}>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="dn-tick" style={{ transform: `rotate(${i * 30}deg) translate(0, -130%)`, animationDelay: i === 0 ? "0s" : `${-(1.2 - 0.1 * i).toFixed(1)}s` }} />
        ))}
      </span>
    </span>
  );
}

/** How long a page may take before the spinner replaces the arrow. Quicker loads never show it. */
const SPINNER_DELAY_MS = 150;

/** Round icon-only link; the page it leads to shows on hover or keyboard focus. */
function PagerButton({ target, side }: { target: Target; side: "prev" | "next" }) {
  const lang = useDocsLang();
  const word = ui(lang, side === "prev" ? "previous" : "next");
  const Icon = side === "prev" ? ArrowLeft : ArrowRight;
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  // The new page is here (or the address changed): back to the arrow.
  useEffect(() => { setLoading(false); setShowSpinner(false); }, [pathname]);
  // Right after the click nothing changes; only a wait longer than SPINNER_DELAY_MS shows the spinner.
  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [loading]);
  return (
    <Link
      href={target.href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab / window: this page stays
        setLoading(true);
      }}
      aria-busy={loading}
      aria-label={`${word}: ${target.title}`}
      className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-overlay/10 bg-canvas-raised text-ink"
    >
      {showSpinner ? <TickSpinner /> : <Icon className="h-5 w-5" />}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full mb-2 max-w-[70vw] whitespace-nowrap rounded-xl border border-overlay/10 bg-canvas-raised px-3 py-1.5 text-sm text-ink opacity-0 shadow-themed transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${side === "prev" ? "left-0" : "right-0"}`}
      >
        <span className="block text-[10px] font-medium uppercase tracking-wide text-ink-muted">{word}</span>
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
/** `prevHi` / `nextHi` are the same targets titled in Hindi, shown when the page language is Hindi. */
export function DocNav({ prev, next, prevHi, nextHi }: { prev?: Target; next?: Target; prevHi?: Target; nextHi?: Target }) {
  const lang = useDocsLang();
  const prevShown = lang === "hi" ? prevHi ?? prev : prev;
  const nextShown = lang === "hi" ? nextHi ?? next : next;
  const [marks, setMarks] = useState<Mark[]>([]);
  const [active, setActive] = useState(0);
  // The bar lines ride up with the footer instead of overlapping it: once the footer's top edge reaches them they are pushed up by exactly the overlap.
  const rail = useRef<HTMLElement>(null);
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const update = () => {
      const footer = document.querySelector("footer");
      const el = rail.current;
      if (!footer || !el) return setLift(0);
      const bottom = window.innerHeight / 2 + el.offsetHeight / 2; // where the rail ends when not lifted
      setLift(Math.max(0, Math.round(bottom + 16 - footer.getBoundingClientRect().top)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [marks]);

  useEffect(() => {
    const found = Array.from(document.querySelectorAll<HTMLElement>(".doc-prose h2[id], .doc-prose h3[id]"))
      .map((el) => ({ id: el.id, text: el.textContent?.trim() ?? "", level: Number(el.tagName[1]) }));
    // Very long pages: keep only the main headings so the column stays short.
    setMarks(found.length > 28 ? found.filter((m) => m.level === 2) : found);
  }, [lang]); // the headings change text (not ids) when the language changes

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
        <nav ref={rail} aria-label={ui(lang, "onThisPage")} style={{ transform: `translateY(calc(-50% - ${lift}px))` }} className="fixed right-4 top-1/2 z-[90] hidden flex-col items-end md:flex">
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
      {(prevShown || nextShown) && (
        <nav aria-label={`${ui(lang, "previous")} / ${ui(lang, "next")}`} className="mt-16 flex items-center justify-between border-t border-overlay/10 pt-6">
          {prevShown ? <PagerButton target={prevShown} side="prev" /> : <span />}
          {nextShown ? <PagerButton target={nextShown} side="next" /> : <span />}
        </nav>
      )}
    </>
  );
}
