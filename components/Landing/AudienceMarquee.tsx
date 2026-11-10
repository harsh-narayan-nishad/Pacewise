"use client";
import { BRAND_NAME } from "@/lib/brand";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Calculator, ChevronLeft, ChevronRight, GraduationCap, Landmark, Stethoscope, Wrench, type LucideIcon } from "lucide-react";

interface Audience { label: string; icon: LucideIcon; hue: string; lead: string; text: string }

const AUDIENCES: Audience[] = [
  { label: "UPSC aspirants", icon: Landmark, hue: "#3F5646", lead: "Get through the syllabus faster.", text: "Turn polity, history and current-affairs notes into stories you can read quickly, then quiz yourself until they stick." },
  { label: "Engineers", icon: Wrench, hue: "#2A3139", lead: "Read specs at the speed of thought.", text: "Skim long documentation and standards without losing the details that matter, and check your understanding as you go." },
  { label: "Doctors & NEET", icon: Stethoscope, hue: "#4A3B58", lead: "Revise more in the same hours.", text: "Compress dense medical chapters into your own notes and track how your speed and recall improve each week." },
  { label: "CA & finance", icon: Calculator, hue: "#6B5A3C", lead: "Keep standards and sections at hand.", text: "Read through circulars, case law and reports quickly, with a quiz after every session to lock in the numbers." },
  { label: "Teachers", icon: GraduationCap, hue: "#5C4A2E", lead: "Share notes your class can quiz on.", text: "Write a lesson once, add questions, and let students read at a pace that suits them." },
];

/** Image for a card: public/audiences/<slug>.jpg (e.g. "Doctors & NEET" -> doctors-neet.jpg). */
const imageFor = (label: string) => `/audiences/${label.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.jpg`;

function Card({ a, wide }: { a: Audience; wide: boolean }) {
  const Icon = a.icon;
  const [hasImage, setHasImage] = useState(true);
  return (
    <li className={`shrink-0 snap-start ${wide ? "w-[min(88vw,43rem)]" : "w-[min(74vw,23rem)]"}`}>
      {/* Same height for every card; only the width changes (as on apple.com). */}
      <div className="relative flex h-[28rem] items-center justify-center overflow-hidden rounded-[28px] bg-[#1d1d1f] sm:h-[36rem]">
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageFor(a.label)} alt="" onError={() => setHasImage(false)} className="absolute inset-0 z-10 h-full w-full object-cover" />
        )}
        <span aria-hidden className="absolute -bottom-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: a.hue }} />
        <span
          aria-hidden
          className={`relative flex items-center justify-center rounded-[2.75rem] text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] ${wide ? "h-52 w-52" : "h-40 w-40"}`}
          style={{ background: `linear-gradient(150deg, ${a.hue}, #101012)` }}
        >
          <Icon className={wide ? "h-20 w-20" : "h-16 w-16"} strokeWidth={1.5} />
        </span>
      </div>
      <p className="mt-5 px-1.5 text-left text-[17px] leading-[1.35] tracking-[-0.01em] text-ink-muted">
        <strong className="font-semibold text-ink">{a.label}. {a.lead}</strong> {a.text}
      </p>
    </li>
  );
}

/** "For every ambitious mind." — an Apple-style carousel of tall audience cards with captions below. */
export function AudienceMarquee() {
  const scroller = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  function page(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  }

  const btn = "flex h-10 w-10 items-center justify-center rounded-full bg-[#1d1d1f]/85 text-white transition-colors hover:bg-[#1d1d1f] disabled:opacity-35 disabled:hover:bg-[#1d1d1f]/85";

  return (
    <section aria-labelledby="aud-h">
      <div className="text-center">
        <h2 id="aud-h" className="font-display text-3xl leading-tight text-ink sm:text-5xl">For every ambitious mind.</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">
          Whatever you are preparing for, write your own notes as stories, quiz yourself, share them with people on the same path, and watch your reading speed climb.
        </p>
      </div>
      <ul
        ref={scroller}
        onScroll={update}
        aria-label={`Who ${BRAND_NAME} is for`}
        className="relative left-1/2 mt-12 flex w-screen -translate-x-1/2 snap-x snap-mandatory items-start gap-5 overflow-x-auto scroll-smooth px-6 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [scroll-padding-inline:max(1.5rem,calc((100vw-72rem)/2+2rem))] sm:px-[max(2rem,calc((100vw-72rem)/2+2rem))] [&::-webkit-scrollbar]:hidden"
      >
        {AUDIENCES.map((a, i) => <Card key={a.label} a={a} wide={i % 3 === 2} />)}
      </ul>
      <div className="mt-10 flex justify-end gap-3">
        <button type="button" onClick={() => page(-1)} disabled={edge.start} aria-label="Previous" className={btn}><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => page(1)} disabled={edge.end} aria-label="Next" className={btn}><ChevronRight className="h-5 w-5" /></button>
      </div>
    </section>
  );
}
