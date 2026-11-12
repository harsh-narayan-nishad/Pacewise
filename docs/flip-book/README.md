# PDF Flip Book — engineering overview

A browser-only PDF reader that turns any PDF (up to 300 MB, 1000+ pages) into a physical-feeling, page-turning book, with full-text search, page editing and a merged-PDF export. ==No server, no upload, works on a mid-range phone.==

This folder documents **how it is built, what was chosen and why**, written the way you would defend it in a senior system-design or front-end architecture interview.

## Documents

- [Architecture and requirements](01-architecture-and-requirements.md) — constraints, layers, data model, the client-only decision
- [Rendering pipeline and performance](02-rendering-and-performance.md) — virtualization, memory budget, workers, cancellation, 60 fps gestures
- [Search system](03-search-system.md) — lazy indexing, two-level cache, offset maps, why no inverted index
- [Editing and export](04-editing-and-export.md) — immutable page model, non-destructive edits, vector-preserving export
- [Security, reliability and the interview playbook](05-security-reliability-interview.md) — threat model, failure modes, stories and likely questions

## The problem in one paragraph

Reading long PDFs on the web is either a scrolling viewer (functional, tiring) or a server-rendered flip book (needs uploads, costs money, leaks private documents). The goal was a flip book that feels like paper, opens a textbook-sized PDF instantly, never sends the file anywhere, and stays smooth on a phone with 3–4 GB of RAM.

## Architecture at a glance

```text
 Route (/flipbook)            app/flipbook/page.tsx          thin shell, full-screen
        │
 Controller                   Reader.tsx                     state, input, lifecycle, theme
        │
 ┌──────┴──────────────┬───────────────────────┬────────────────────────┐
 View: flip engine      View: page renderers    Panels                   
 flip-book/ (own code)  pages.tsx (canvas)      search, tray, editors    
        │                       │                        │
        └──────────── Domain (pure TypeScript, no React) ┘
                      lib/flipreader/: loaders, search, pdftext, overlays, export, gestures
                                │
              pdf.js Web Worker (parse + rasterize off the main thread)
              IndexedDB (text cache) · localStorage (small prefs)
```

## Key decisions

| Decision | Alternatives considered | Why this one | Cost we accepted |
| --- | --- | --- | --- |
| Everything client-side | Server renders pages to images | Zero infra cost, privacy by construction, no upload latency | Limited by device memory; no cross-device sync |
| pdf.js in a Web Worker, lazy-loaded | Native `<embed>`, server PDF → image | Full control of drawing, text and search; ~400 KB only when needed | Big dependency to pin and keep in sync |
| Own page-turn engine (CSS 3D + rAF) | Third-party flip library | Needed zoom-aware input, hold/tap gestures, motion blur, rotation | More code to own and test |
| Render window of ±4 pages | Render all pages, or only the visible one | Bounded memory (O(1) in book size) with pre-rendered next flips | Very fast jumps briefly show a loader |
| Linear scan over cached page text | Inverted index | Small corpus (MBs), phrase search for free, near-zero build cost | O(total text) per query; fine up to tens of MB |
| Immutable page list + `rev` | Mutating arrays in place | Cheap undo, trivial cache invalidation, React-friendly | A new array per edit (pages are shared, so cheap) |
| Copy PDF pages with `pdf-lib` on export | Rasterize every page | Keeps vector text, small files, selectable text | Overlays on PDF pages are rasterized |

## Numbers worth knowing

| Quantity | Value | Why it matters |
| --- | --- | --- |
| One A4 page canvas on a 2× screen | ≈ 1400 × 1980 × 4 B ≈ 11 MB | 1000 pages would need ≈ 11 GB |
| Pages with a canvas at once | ≤ 9 (±4) plus 5 around a jump target | ≈ 100 MB ceiling, independent of book length |
| Canvas hard cap | 4096 px side, 16 M pixels (≈ 64 MB) | Above this, mobile Safari silently draws nothing |
| Concurrency | 3 text extractions, 3 thumbnails | Keeps the worker busy without starving the visible page |
| Caches | 4 search indexes in memory, 8 books in IndexedDB | LRU, bounded; storage failure falls back to recompute |

## Principles worth keeping

- **Bound every resource by design**, not by hope: canvases, concurrency, caches and file size all have explicit limits.
- **Pure domain code, thin React**: the hard logic (`lib/flipreader/`) has no React, so it is testable and reusable.
- **One source of truth for shared math**: the same text normaliser for search and highlight; the same overlay renderer for screen and export.
- **Lazy everything**: pdf.js, pdf-lib and JSZip download only when used; text is extracted only when needed.
- **Degrade, never break**: storage blocked, Fullscreen API missing, SVG backdrop filters unsupported — each has a fallback.

## Anti-patterns avoided

- Uploading user files to "make it easier" — it creates cost, latency and a privacy liability.
- Keeping one canvas per page "because it is simpler" — this is what crashes mobile tabs.
- Driving 60 fps gestures through React state — every frame would re-render the tree.
- Unpinned rendering libraries — a library/worker version mismatch breaks every PDF at once.
