"use client";

import React from "react";

// Shared by the "Add your own story" and "Edit story" modals so both look identical.
/** Underlined input whose label floats up when focused or filled (the "Request callback" form style). */
export function FloatingField({ id, label, value, onChange, multiline }: { id: string; label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const base =
    "peer block w-full border-0 border-b border-ink/40 bg-transparent pb-2 pt-7 text-lg text-ink outline-none transition-colors focus:border-accent-medium";
  return (
    <div className="relative">
      {multiline ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " rows={2} className={`${base} resize-none`} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " className={base} />
      )}
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-0 top-7 text-lg text-ink-muted transition-all duration-150 peer-focus:top-1 peer-focus:text-sm peer-focus:text-accent-medium peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-sm"
      >
        {label}
      </label>
    </div>
  );
}

export function SectionHeading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <h3 className="mb-5 flex items-baseline gap-3 text-xl font-medium text-ink">
      {children}
      {note && <span className="text-sm font-normal text-ink-muted">{note}</span>}
    </h3>
  );
}

