"use client";
import { BRAND_NAME } from "@/lib/brand";

import React from "react";
import { BookMarked, Briefcase, Calculator, Code2, Gavel, GraduationCap, Landmark, Microscope, Rocket, Scale, Stethoscope, Wrench, type LucideIcon } from "lucide-react";

interface Audience { label: string; icon: LucideIcon; hue: string }

const ROW_1: Audience[] = [
  { label: "UPSC aspirants", icon: Landmark, hue: "#3F5646" },
  { label: "Engineers", icon: Wrench, hue: "#2A3139" },
  { label: "Doctors & NEET", icon: Stethoscope, hue: "#4A3B58" },
  { label: "CA & finance", icon: Calculator, hue: "#6B5A3C" },
  { label: "Entrepreneurs", icon: Rocket, hue: "#7A3E32" },
  { label: "Law students", icon: Scale, hue: "#34495E" },
];
const ROW_2: Audience[] = [
  { label: "Researchers", icon: Microscope, hue: "#2F5D62" },
  { label: "Developers", icon: Code2, hue: "#3D3A5C" },
  { label: "Teachers", icon: GraduationCap, hue: "#5C4A2E" },
  { label: "MBA & CAT", icon: Briefcase, hue: "#44525C" },
  { label: "Judiciary prep", icon: Gavel, hue: "#5A3A4A" },
  { label: "Lifelong learners", icon: BookMarked, hue: "#365A44" },
];

function Item({ a, i }: { a: Audience; i: number }) {
  const Icon = a.icon;
  const tilt = ["-rotate-6", "rotate-3", "-rotate-3", "rotate-6"][i % 4];
  return (
    <li className="flex shrink-0 items-center gap-4 px-6 sm:px-8">
      <span
        aria-hidden
        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-themed sm:h-[4.5rem] sm:w-[4.5rem] ${tilt}`}
        style={{ background: `linear-gradient(145deg, ${a.hue}, #0f1115)` }}
      >
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
      </span>
      <span className="whitespace-nowrap text-xl text-ink sm:text-2xl">{a.label}</span>
    </li>
  );
}

function Row({ items, reverse }: { items: Audience[]; reverse?: boolean }) {
  // The list is rendered twice and translated by -50%, so the loop is seamless.
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <ul className={`flex w-max ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}>
        {[...items, ...items].map((a, i) => <Item key={`${a.label}-${i}`} a={a} i={i} />)}
      </ul>
    </div>
  );
}

/** "For every ambitious mind." — two rows of fields scrolling in opposite directions. */
export function AudienceMarquee() {
  return (
    <section aria-labelledby="aud-h" className="text-center">
      <h2 id="aud-h" className="font-display text-3xl leading-tight text-ink sm:text-5xl">For every ambitious mind.</h2>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">
        Whatever you are preparing for, write your own notes as stories, quiz yourself, share them with people on the same path, and watch your reading speed climb.
      </p>
      <div className="mt-10 space-y-6" role="list" aria-label={`Who ${BRAND_NAME} is for`}>
        <Row items={ROW_1} />
        <Row items={ROW_2} reverse />
      </div>
    </section>
  );
}
