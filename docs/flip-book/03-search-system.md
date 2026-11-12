# Search system

Full-text search over a PDF entirely in the browser: how the index is built and cached, why it is a scan and not an inverted index, and how a hit is highlighted at the exact characters on a canvas.

## 1. Constraints

- The text lives inside the PDF; extracting it costs a worker round trip per page.
- Search must work while extraction is still running (progressive results).
- Re-opening the same book should not re-extract.
- A hit must be highlighted precisely on a rasterised page.

## 2. Pipeline

```text
open search
  └─ getIndex(doc)                    key = doc.key + "#" + doc.rev     (memory LRU, 4 entries)
       └─ buildIndex                  3 concurrent workers over pages, cancellable, resumable
            ├─ hydrate from IndexedDB  per source file, if seen before   (LRU, 8 files)
            ├─ getTextContent → normalizeItems → page.cleanup()
            └─ when a file is complete → persist to IndexedDB
query → linear scan of folded page strings → hits with context
```

## 3. Why a scan, not an inverted index

| Option | Build cost | Query cost | Phrase search | Memory |
| --- | --- | --- | --- | --- |
| Linear scan (`indexOf` over each page) | None beyond extraction | O(total text) | Free | 1× text (+1× folded copy) |
| Inverted index (word → postings) | Tokenise every page | O(postings) | Needs positions | 2–4× text |
| Trie / n-gram index | Highest | Fast prefix / fuzzy | Needs positions | Highest |

A 1000-page textbook is roughly 2–5 MB of text. `indexOf` over that is a few milliseconds — below human perception — and phrase queries come for free. An index would add build time on the device for no visible gain. ==Pick the simplest structure that meets the latency budget, and know the point where it stops doing so== (tens of MB of text, or fuzzy search) — then move to an inverted index in a worker.

## 4. Caching and invalidation

- **Two levels.** Memory (`Map` used as an LRU of 4 books) for instant re-search; IndexedDB (`flip-reader` / `text-index`, LRU of 8 files) across visits.
- **Cache per source, not per revision.** Text is stored per PDF file; the per-revision index is assembled from it. Reordering or deleting pages bumps `rev` but never re-extracts.
- **Content-derived keys.** `name | size | lastModified` identifies a file without hashing 300 MB. Collisions are practically impossible for real files; the cost of one would be wrong search text, not data loss.
- **Storage is optional.** Every IndexedDB call is wrapped; private mode or quota errors return `null` and the system recomputes.

## 5. One normaliser, two consumers

pdf.js returns text as positioned fragments. `normalizeItems` joins them (collapse whitespace, drop soft hyphens, separate items) and, on request, also returns a **character map** from each output character back to `(item, char)`.

```ts title="lib/flipreader/pdftext.ts" principle="Single source of truth — search offsets and highlight offsets come from the same function"
export function normalizeItems(items: RawItem[], withMap = false): PageText {
```

Search uses the string; highlighting re-runs the same function with the map. Because both sides use identical normalisation, an offset found by search always maps to the right glyphs. Lower-casing is done with `fold`, which preserves string length so offsets stay valid.

## 6. From offset to pixels

`rectsForRange` multiplies each fragment's text matrix by the viewport transform (2D affine composition), then interpolates character positions proportionally to the fragment width. It handles rotated and skewed text because it works in matrix space, not with axis-aligned assumptions. The result is a list of rectangles drawn above the canvas.

## 7. Query semantics and limits

- Case-insensitive; quotes stripped; whitespace collapsed; minimum 2 characters.
- Phrase first. If a multi-word phrase has no hit anywhere, fall back to "pages containing all words".
- Bounded output: 300 hits total, 6 per page, ~100 characters of context, cut at word boundaries.

## 8. Known gaps and next steps

| Gap | Approach |
| --- | --- |
| Scanned PDFs have no text | On-device OCR (WASM) feeding the same `pages: string[]` interface |
| No fuzzy / stemming | Inverted index with normalised tokens, built in a worker |
| Main-thread scan on huge books | Move `search()` into the worker and stream hits |
| Ranking | Currently page order; could add term frequency per page |
