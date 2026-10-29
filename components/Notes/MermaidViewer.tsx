"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Copy, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

const MIN = 0.2;
const MAX = 6;
const STEP = 80; // px moved by one arrow press

/* Mermaid and its ELK layout (orthogonal edges with line hops, like GitHub's viewer) are loaded on demand from a CDN, so nothing to install. */
const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.esm.min.mjs";
const ELK_URL = "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.2.3/dist/mermaid-layout-elk.esm.min.mjs";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MermaidApi = any;
let mermaidPromise: Promise<MermaidApi> | null = null;
function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      const mermaid = (await import(/* webpackIgnore: true */ MERMAID_URL)).default;
      try {
        const elk = (await import(/* webpackIgnore: true */ ELK_URL)).default;
        mermaid.registerLayoutLoaders(elk);
      } catch {
        /* without ELK the default layout is used */
      }
      return mermaid;
    })().catch((e) => { mermaidPromise = null; throw e; });
  }
  return mermaidPromise;
}

let counter = 0;
const isDark = () => {
  const el = document.documentElement;
  return el.classList.contains("dark") || el.dataset.theme === "dark" || (!el.dataset.theme && !el.classList.contains("light") && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
};

/**
 * A Mermaid diagram you can work with, like GitHub's viewer: drag to pan, buttons (or the arrow keys) to move,
 * zoom in/out (Ctrl/Cmd + wheel, pinch-free buttons), reset, expand to full screen and copy the source.
 */
export function MermaidViewer({ source }: { source: string }) {
  const idRef = useRef(`mmd-${++counter}`);
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const natural = useRef({ w: 0, h: 0 });
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dark, setDark] = useState(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // Follow the site's light/dark switch.
  useEffect(() => {
    setDark(isDark());
    const mo = new MutationObserver(() => setDark(isDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => mo.disconnect();
  }, []);

  // Render with Mermaid (loaded on demand so it never weighs on pages without diagrams).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default", fontFamily: "inherit", layout: "elk" });
        let out;
        try {
          out = await mermaid.render(`${idRef.current}-${Date.now()}`, source);
        } catch {
          mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default", fontFamily: "inherit", layout: "dagre" });
          out = await mermaid.render(`${idRef.current}-b-${Date.now()}`, source);
        }
        if (alive) { setSvg(out.svg); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [source, dark]);

  const fit = useCallback(() => {
    const f = frame.current;
    const svgEl = stage.current?.querySelector("svg");
    if (!f || !svgEl) return;
    const vb = svgEl.viewBox?.baseVal;
    const w = vb && vb.width ? vb.width : svgEl.getBoundingClientRect().width;
    const h = vb && vb.height ? vb.height : svgEl.getBoundingClientRect().height;
    svgEl.setAttribute("width", String(w));
    svgEl.setAttribute("height", String(h));
    (svgEl as SVGSVGElement).style.maxWidth = "none";
    natural.current = { w, h };
    const k = Math.min(1, (f.clientWidth - 32) / w, (f.clientHeight - 32) / h);
    const kk = Math.max(MIN, k);
    setView({ k: kk, x: (f.clientWidth - w * kk) / 2, y: Math.max(16, (f.clientHeight - h * kk) / 2) });
  }, []);

  useEffect(() => { if (svg) fit(); }, [svg, full, fit]);

  const zoomAt = (factor: number, cx?: number, cy?: number) =>
    setView((v) => {
      const f = frame.current;
      const px = cx ?? (f ? f.clientWidth / 2 : 0);
      const py = cy ?? (f ? f.clientHeight / 2 : 0);
      const k = Math.min(MAX, Math.max(MIN, v.k * factor));
      const r = k / v.k;
      return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
    });
  const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));

  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return; // plain wheel keeps scrolling the page
      e.preventDefault();
      const r = f.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    f.addEventListener("wheel", onWheel, { passive: false });
    return () => f.removeEventListener("wheel", onWheel);
  }, [svg, full]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [full]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(source); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowUp: () => pan(0, STEP), ArrowDown: () => pan(0, -STEP), ArrowLeft: () => pan(STEP, 0), ArrowRight: () => pan(-STEP, 0),
      "+": () => zoomAt(1.25), "=": () => zoomAt(1.25), "-": () => zoomAt(1 / 1.25), "0": fit,
    };
    const run = map[e.key];
    if (run) { e.preventDefault(); run(); }
  };

  const btn = "flex h-8 w-8 items-center justify-center rounded-lg border border-overlay/10 bg-canvas text-ink-muted shadow-sm transition-colors hover:bg-overlay/10 hover:text-ink active:scale-95";

  if (failed) {
    return (
      <pre className="doc-diagram-fallback" data-lang="mermaid"><code>{source}</code></pre>
    );
  }

  return (
    <div className={full ? "fixed inset-0 z-[90] flex flex-col bg-canvas p-3 pt-[4.5rem] sm:p-6 sm:pt-[5.5rem]" : "relative my-8"}>
      <div
        ref={frame}
        tabIndex={0}
        role="group"
        aria-label="Diagram. Drag to move, use the buttons or arrow keys to pan, plus and minus to zoom."
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-ctl]")) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
          setDragging(true);
        }}
        onPointerMove={(e) => { const d = drag.current; if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y })); }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        className={`relative select-none overflow-hidden rounded-[32px] border border-overlay/10 bg-canvas-raised outline-none focus-visible:ring-2 focus-visible:ring-[#306fdb]/50 ${full ? "min-h-0 flex-1" : "h-[min(78vh,680px)]"} ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
      >
        {svg ? (
          <div ref={stage} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">Drawing diagram…</div>
        )}

        {/* top-right: expand + copy (as on GitHub) */}
        <div data-ctl className="absolute right-3 top-3 flex gap-1.5">
          <button type="button" onClick={() => setFull((v) => !v)} aria-label={full ? "Exit full screen" : "Expand diagram"} title={full ? "Exit full screen" : "Expand"} className={btn}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={copy} aria-label="Copy diagram source" title="Copy source" className={btn}>
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        {/* bottom-right: the pad — arrows around reset, zoom */}
        <div data-ctl className="absolute bottom-3 right-3 flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => zoomAt(1.25)} aria-label="Zoom in" title="Zoom in" className={btn}><ZoomIn className="h-4 w-4" /></button>
            <button type="button" onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom out" title="Zoom out" className={btn}><ZoomOut className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <span />
            <button type="button" onClick={() => pan(0, STEP)} aria-label="Move up" title="Up" className={btn}><ArrowUp className="h-4 w-4" /></button>
            <span />
            <button type="button" onClick={() => pan(STEP, 0)} aria-label="Move left" title="Left" className={btn}><ArrowLeft className="h-4 w-4" /></button>
            <button type="button" onClick={fit} aria-label="Reset view" title="Reset" className={btn}><RotateCcw className="h-4 w-4" /></button>
            <button type="button" onClick={() => pan(-STEP, 0)} aria-label="Move right" title="Right" className={btn}><ArrowRight className="h-4 w-4" /></button>
            <span />
            <button type="button" onClick={() => pan(0, -STEP)} aria-label="Move down" title="Down" className={btn}><ArrowDown className="h-4 w-4" /></button>
            <span />
          </div>
        </div>
      </div>
      <p className="mt-2 px-2 text-center text-xs text-ink-muted">Drag to move · Ctrl/⌘ + scroll to zoom · arrow keys, + and − work too</p>
    </div>
  );
}
