"use client";

import React from "react";
import { NOTES } from "@/lib/notesContent";
import { BRAND_BLUE } from "@/lib/brand";

/** The notes themselves — used inside the profile's Notes tab and on the public page the QR code opens. */
export function NotesView() {
  return (
    <div className="space-y-6">
      {NOTES.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`} className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-5 pb-6 pt-8 sm:px-10 sm:pt-10">
          <h2 id={`${section.id}-h`} className="font-display text-[34px] leading-[1.1] tracking-[-0.035em] text-ink sm:text-4xl sm:leading-tight sm:tracking-[-0.03em]">{section.title}.</h2>
          <p className="mt-2 text-base text-ink-muted sm:text-lg">{section.summary}</p>
          <ul className="mt-6 divide-y divide-overlay/10">
            {section.items.map((item) => (
              <li key={item.topic} className="py-5">
                <h3 className="text-lg font-medium text-ink">{item.topic}</h3>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">
                  <span className="font-medium" style={{ color: BRAND_BLUE }}>Used here: </span>
                  {item.used}
                </p>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink">Tradeoff: </span>
                  {item.tradeoff}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
