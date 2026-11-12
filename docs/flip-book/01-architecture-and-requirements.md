# Architecture and requirements

How the requirements shaped the architecture of the PDF flip book, and the reasoning behind each layer.

## 1. Requirements

| Kind | Requirement |
| --- | --- |
| Functional | Open PDFs (and images, EPUB, text) as a two-page book with a realistic page turn |
| Functional | Search the whole book, jump to a hit, highlight it on the page |
| Functional | Reorder, add, delete and annotate pages; download the result as one PDF |
| Non-functional | First page visible in under ~1 s for a typical PDF on a mid-range phone |
| Non-functional | Memory bounded regardless of page count (1000+ pages) |
| Non-functional | 60 fps page drag; no jank while pages render |
| Non-functional | The file never leaves the device; works offline once loaded |
| Out of scope | Accounts, cloud sync, OCR, real-time collaboration |

## 2. The biggest decision: client-only

A server-side design (upload → render pages to images on a worker fleet → serve from a CDN) is the textbook answer for a flip-book SaaS. It was rejected here:

- **Privacy**: users open notes, textbooks and personal documents. Not storing them removes a whole class of risk (breach, retention, compliance).
- **Cost**: rasterising a 1000-page PDF at two resolutions is minutes of CPU and gigabytes of storage per upload. Client-side, the cost is zero and scales with users for free.
- **Latency**: no upload of a 100 MB file before reading can start.

**Trade-off owned:** we inherit the device's limits (memory, CPU, browser quirks), so the rest of the design is about being frugal on the client. Cross-device continuity would need a different design (see the interview playbook).

## 3. Layers

```text
app/flipbook/page.tsx        Route shell. Opens handed-off files or redirects. Full screen, no app chrome.
Reader.tsx                   Controller: owns state, wires input → engine, lifecycle (open / release).
flip-book/                   View: page-turn engine. DOM leaves + CSS 3D, rAF animation, pointer capture.
reader/pages.tsx             View: one page = one canvas (PDF), image or text block.
lib/flipreader/*             Domain: loaders, search, text maps, overlays, export, gestures. No React.
pdf.js worker                Parsing and rasterising off the main thread.
```

Why this split matters:

- **Domain without React** — `gestures.ts` (tap-skip and hold-flip timing), `search.ts`, `pdftext.ts` are plain functions and classes. They can be unit-tested in Node and tuned without touching UI.
- **Engine reads from a mutable state object, not React state** — timers and pointer handlers never close over stale props; React only re-renders when something user-visible changes.
- **Controller is the only place with side effects across modules** — opening, releasing, keyboard, theme. Easier to reason about lifetimes.

## 4. Data model

```ts title="lib/flipreader/types.ts" principle="Indirection: pages point into shared sources; sources are never copied"
export type PdfItem = { id: string; type: 'pdf'; src: PdfSource; index: number; overlays: Overlay[] };
export type ImageItem = { id: string; type: 'image'; src: ImageSource; edit: ImageEdit; overlays: Overlay[] };
export type PageItem = PdfItem | ImageItem;
```

- **Sources vs items.** A `PdfSource` holds the parsed document once; each page is a tiny `PdfItem` pointing to `(source, index)`. Mixing several PDFs and images in one book, reordering or duplicating pages costs a few bytes, never a re-parse (the flyweight idea).
- **Immutable `PagesDoc` with `rev`.** Every edit produces a new document whose `rev` increases. Undo is a stack of previous `items` arrays (structural sharing: the item objects are reused). Caches key on `doc.key + rev`, so invalidation is automatic.
- **Stable book identity.** `key = hash(name | size | lastModified)` of every file. Per-book state (cover design, cached text) survives reloads without storing the file.
- **Discriminated unions everywhere** (`kind`, `type`) — the compiler forces every renderer and exporter to handle every page type.

## 5. Moving a `File` between screens

The search bar and the reader are different routes. A `File` cannot go through a URL or Web Storage, and must not be uploaded. The hand-off is a module-level variable, read once (`takePendingFiles()`), which is the simplest thing that works inside one SPA session. Refresh loses it by design, so the route redirects home instead of showing an empty reader.

## 6. Code splitting

```ts title="lib/flipreader/loaders.ts" principle="Pay for a dependency only when the feature is used"
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker-${pdfjs.version}.min.mjs`;
```

pdf.js (~400 KB), pdf-lib (export) and JSZip (EPUB) are all dynamic imports, so the rest of Pacewise never downloads them.

## 7. What changes at 10× / 100×

| Pressure | Next step |
| --- | --- |
| Books of 5 000+ pages | Move text extraction and search to a dedicated worker; stream the index |
| Weak devices | Lower `devicePixelRatio` cap, smaller window (±2), JPEG-backed page cache |
| Cross-device reading | Store only metadata (position, highlights) server-side, keyed by content hash |
| Shared annotations | Overlays already have stable ids and normalised coordinates — a CRDT list per page fits |
| Scanned books | On-device OCR (WASM) behind the existing text interface, so search needs no change |
