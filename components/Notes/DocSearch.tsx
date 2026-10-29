"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { docFolders, docUrl } from "@/lib/docs/library";
import type { SearchEntry } from "@/lib/docs/search.generated";

/* The pill follows the site theme (data-theme), not the OS: light gradient in light/sepia, dark glass in dark. */
const SEARCH_CSS = `
.doc-search-input{color:rgb(34,34,34);background:linear-gradient(142.99deg,rgba(217,217,217,.63) 15.53%,rgba(243,243,243,.63) 88.19%);box-shadow:0 12px 24px -1px rgba(0,0,0,.18)}
.doc-search-input::placeholder{color:rgba(34,34,34,.6)}
:root[data-theme="dark"] .doc-search-input{color:#f2f2f2;background:linear-gradient(142.99deg,rgba(255,255,255,.14) 15.53%,rgba(255,255,255,.07) 88.19%);border-color:rgba(255,255,255,.12);box-shadow:0 12px 24px -1px rgba(0,0,0,.5)}
:root[data-theme="dark"] .doc-search-input::placeholder{color:rgba(242,242,242,.55)}
`;

const FOLDER = new Map(docFolders().map((f) => [f.id, f.label]));

interface Hit { entry: SearchEntry; score: number; snippet: string }

function search(index: SearchEntry[], q: string): Hit[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: Hit[] = [];
  for (const e of index) {
    const title = e.title.toLowerCase();
    const heading = e.heading.toLowerCase();
    const text = e.text.toLowerCase();
    const folder = (FOLDER.get(e.folder) ?? "").toLowerCase();
    if (!words.every((w) => title.includes(w) || heading.includes(w) || text.includes(w) || folder.includes(w))) continue;
    let score = 0;
    for (const w of words) score += (title.includes(w) ? 6 : 0) + (heading.includes(w) ? 4 : 0) + (text.includes(w) ? 1 : 0);
    // Snippet: the text around the first word found in the body (or the start of the section).
    const at = words.map((w) => text.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
    const from = Math.max(0, at - 40);
    const snippet = (from > 0 ? "…" : "") + e.text.slice(from, from + 130) + (from + 130 < e.text.length ? "…" : "");
    hits.push({ entry: e, score, snippet });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 8);
}

/** Wraps the searched words in <mark> so the match is easy to spot in the result. */
function Marked({ text, q }: { text: string; q: string }) {
  const words = q.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-[#306fdb]/20 px-0.5 text-inherit">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
}

/**
 * Search field for the public notes navbar: a pill that widens on hover and focus (200 → 240 → 280px).
 * It searches everything written on the pages (titles, headings and body text) and opens the matching
 * section; Enter opens the first result.
 */
export function DocSearch({ userId }: { userId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // The index holds every document's text, so it is fetched only when the search is first used.
  const load = () => { if (!index) import("@/lib/docs/search.generated").then((m) => setIndex(m.SEARCH_INDEX)).catch(() => setIndex([])); };
  const results = useMemo(() => (index ? search(index, q) : []), [index, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const href = (h: Hit) => docUrl(userId, h.entry.slug) + (h.entry.id ? `#${h.entry.id}` : "");
  const go = (h: Hit) => { setOpen(false); setQ(""); router.push(href(h)); };

  return (
    <div ref={box} className="relative">
      <style dangerouslySetInnerHTML={{ __html: SEARCH_CSS }} />
      <input
        type="text"
        name="text"
        value={q}
        placeholder="Search docs"
        aria-label="Search everything in the documents"
        autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); load(); }}
        onFocus={() => { setOpen(true); load(); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && results[active]) go(results[active]);
        }}
        className="doc-search-input block w-[132px] rounded-full border border-transparent px-[15px] py-[9px] text-center text-sm outline-none transition-[width] duration-500 sm:w-[200px] sm:hover:w-[240px] focus:w-[min(280px,52vw)] sm:focus:w-[280px]"
      />
      {open && q.trim() && (
        <ul role="listbox" className="absolute left-1/2 top-full z-[110] mt-2 max-h-[70vh] w-[min(420px,92vw)] -translate-x-1/2 overflow-y-auto rounded-3xl border border-overlay/10 bg-canvas p-1.5 shadow-themed">
          {!index && <li className="px-3 py-2.5 text-sm text-ink-muted">Searching…</li>}
          {index && results.length === 0 && <li className="px-3 py-2.5 text-sm text-ink-muted">Nothing found for “{q.trim()}”</li>}
          {results.map((h, i) => (
            <li key={`${h.entry.slug}#${h.entry.id}-${i}`} role="option" aria-selected={i === active}>
              <Link href={href(h)} onClick={() => { setOpen(false); setQ(""); }} onMouseEnter={() => setActive(i)} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 text-sm ${i === active ? "bg-overlay/[0.08]" : ""}`}>
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                <span className="min-w-0">
                  <span className="block text-ink"><Marked text={h.entry.title} q={q} />{h.entry.id ? <span className="text-ink-muted"> › <Marked text={h.entry.heading} q={q} /></span> : null}</span>
                  {h.snippet && <span className="mt-0.5 block text-xs leading-snug text-ink-muted"><Marked text={h.snippet} q={q} /></span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
