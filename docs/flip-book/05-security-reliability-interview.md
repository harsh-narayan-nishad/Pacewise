# Security, reliability and the interview playbook

The threat model and failure handling of the PDF flip book, followed by how to present the project in a senior engineering interview.

## 1. Threat model

| Threat | Mitigation |
| --- | --- |
| A malicious PDF runs code (PDF JavaScript, font programs) | `isEvalSupported: false`; parsing in a Web Worker; pdf.js never executes document scripts |
| Leaking a private document | The file is never uploaded or stored; only extracted text (for search) is cached locally, LRU-bounded |
| Script injection through file names or text | Rendered as text nodes or canvas pixels; no `innerHTML` from document content |
| Supply-chain / CDN tampering | pdf.js worker, character maps and fonts are self-hosted from `public/`, copied at build time |
| A huge or crafted file freezes the tab | Size limits (PDF 300 MB, image 40 MB), canvas caps, concurrency limits, cancellable work |
| Clickjacking / framing | App-wide security headers (`X-Frame-Options`, `nosniff`, HSTS, COOP) |

## 2. Version pinning as a reliability feature

```ts title="lib/flipreader/loaders.ts" principle="The worker URL contains the library version — a mismatch is impossible"
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker-${pdfjs.version}.min.mjs`;
```

pdf.js refuses to run when the library and worker versions differ, which would break **every** PDF at once. The package is pinned to an exact version, and the build script writes a worker file named after that version, so a stale cached worker can never be picked up.

## 3. Failure modes and graceful degradation

| Failure | Behaviour |
| --- | --- |
| Password-protected or damaged PDF | Specific, human error message; other files in the batch still open |
| One page fails to render | The error is logged and that page keeps its loader; the rest of the book works |
| IndexedDB blocked or full | Search still works; text is recomputed |
| Fullscreen API missing (iOS Safari) | CSS "fill the window" fallback |
| SVG backdrop filters unsupported | Glass controls fall back to blur + tint |
| Page refresh mid-session | Redirect home (the `File` is gone by design) instead of an empty screen |

## 4. Accessibility and UX quality

- `prefers-reduced-motion`: 120 ms flips, no motion blur, slower spinners.
- `aria-live` page announcements and status regions for loading and errors.
- Full keyboard model (arrows, space, search, full screen, escape).
- Theme follows the host app (dark / light / sepia) through CSS variables, scoped to the reader container.

## 5. Testing strategy

- **Pure domain modules** (gestures, search, text normalisation, pagination) are unit-testable in Node because they have no React or DOM dependency.
- **Manual matrix** that catches real regressions: small PDF, 900-page PDF, scanned PDF, PDF without embedded fonts, password-protected PDF; Chrome, Safari iOS, Android Chrome.
- **Memory regression check**: heap snapshot after leaving the reader returns to baseline.
- Next step: Playwright visual tests on fixed PDFs, and a performance budget in CI (time to first page, peak memory).

## 6. Interview playbook

### 30-second pitch

"I built a browser-only PDF flip-book reader. It opens 300 MB, 1000-page PDFs on a phone with constant memory by virtualising page canvases, keeps 60 fps page turns by animating outside React, searches the full text with a two-level cache, and exports a merged PDF that keeps vector text. Nothing is uploaded, so it costs nothing to run and is private by design."

### Two-minute deep dive (pick one)

1. **Memory**: 11 MB per page canvas → windowing (±4) → hard caps for Safari → lifecycle (`cancel`, `cleanup`, `destroy`, `WeakMap`) → verify with heap snapshots.
2. **Search**: why a linear scan beats an inverted index at this size → caching per source with `rev` invalidation → one normaliser for search and highlight → affine transforms to place the highlight.
3. **Export**: immutable model → `copyPages` to keep vectors → overlays rasterised for script fidelity → yielding for responsiveness.

### Stories (STAR)

Each row is the problem a guard in the code exists to prevent. ==Tell it only as far as it matches what you actually saw and measured==, and use your own numbers.

| Situation | Action | Result |
| --- | --- | --- |
| One canvas per page exhausts memory on large PDFs (mobile tabs get killed) | Computed the per-canvas cost, introduced the render window, `canvas.width = 0` and pixel caps | Memory flat regardless of book length |
| A stale worker file from an older pdf.js version breaks every PDF at once | Made the worker URL carry the library version | Exact pinning + version-named worker file; class of bug eliminated |
| Large uploads silently lost data in an earlier feature | Found storage quota failures were silent | Rule: never store user files in Web Storage; the flip book keeps files in memory only |
| Fast flipping queues renders for pages already gone | Cancel a render when its page leaves the window; pause rendering above 4 pages/s | The visible page never waits behind stale work |

### Questions to expect

| Question | Strong answer, in short |
| --- | --- |
| Why not render on a server? | Cost, privacy and latency; trade-off is device limits, handled with strict budgets |
| How do you guarantee bounded memory? | Windowing + caps + explicit release; memory is O(window), not O(pages) |
| Why not an inverted index? | Corpus is MBs; scan is ms and supports phrases; switch point is tens of MB or fuzzy search |
| How would you add cross-device sync? | Sync only metadata (position, highlights, overlays) keyed by content hash; never the file |
| How would you support collaborative annotations? | Overlays already have ids and normalised coordinates; use a CRDT per page over WebSocket |
| What would you change with a team of 5? | Worker-based search, OCR, Playwright + perf budgets in CI, telemetry for render times |
| Biggest risk in this design? | Browser-specific limits (canvas size, memory); mitigated with caps, fallbacks and device testing |

### Signals this project demonstrates

- Back-of-the-envelope estimation driving design (memory budget before code).
- Choosing the simplest data structure that meets the latency budget, and knowing when it stops being enough.
- Clear separation of pure domain logic from UI, enabling testing and reuse.
- Owning trade-offs explicitly instead of hiding them.
