"use client";

import * as React from "react";

const THEME = ["#000000", "#434343", "#666666", "#999999", "#cccccc", "#efefef", "#f3f3f3", "#ffffff",
  "#e5484d", "#f76b15", "#ffc53d", "#30a46c", "#12a594", "#0091ff", "#6e56cf", "#d6409f",
  "#f4c7c3", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#cfe2f3", "#d9d2e9", "#ead1dc"];

export function toHex(input: string): string | null {
  const s = input.trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return `#${h.toLowerCase()}`;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(s);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
  const hsl = /^hsla?\(\s*(-?\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)%[\s,]+(\d+(?:\.\d+)?)%/i.exec(s);
  if (hsl) {
    const h = ((Number(hsl[1]) % 360) + 360) % 360, sat = Math.min(100, Number(hsl[2])) / 100, l = Math.min(100, Number(hsl[3])) / 100;
    const a = sat * Math.min(l, 1 - l);
    const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

interface Props {
  title: string;
  recent: string[];
  onPick(color: string | null): void;
  onClose(): void;
}

/** Palette + recent + free entry in HEX, rgb() or hsl(). `null` = reset. */
export function ColorPopover({ title, recent, onPick, onClose }: Props): React.ReactElement {
  const [text, setText] = React.useState("");
  const parsed = text ? toHex(text) : null;
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
  }, [onClose]);
  return (
    <div className="sr-pop" ref={ref} role="dialog" aria-label={title} onMouseDown={(e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); }}>
      <div className="sr-lbl">{title}</div>
      <div className="sr-swatches">
        {THEME.map((c) => <button key={c} type="button" className="sr-swatch" style={{ background: c }} aria-label={c} title={c} onClick={() => onPick(c)} />)}
      </div>
      {recent.length > 0 && (<>
        <div className="sr-lbl">Recent</div>
        <div className="sr-swatches">{recent.map((c) => <button key={c} type="button" className="sr-swatch" style={{ background: c }} aria-label={c} title={c} onClick={() => onPick(c)} />)}</div>
      </>)}
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="#1a2b3c · rgb(26,43,60) · hsl(210,40%,17%)" aria-label="Custom colour"
        onKeyDown={(e) => { if (e.key === "Enter" && parsed) onPick(parsed); }} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span className="sr-swatch" style={{ background: parsed ?? "transparent", width: 24, height: 24 }} aria-hidden />
        <button type="button" className="sr-btn" disabled={!parsed} onClick={() => parsed && onPick(parsed)}>Apply</button>
        <button type="button" className="sr-btn" onClick={() => onPick(null)}>Reset</button>
      </div>
    </div>
  );
}
