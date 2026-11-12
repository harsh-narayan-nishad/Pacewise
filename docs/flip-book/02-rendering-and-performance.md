# Rendering pipeline and performance

How a 1000-page PDF stays smooth on a phone: the memory budget, virtualization, off-main-thread work, cancellation and gesture handling.

## 1. The memory budget comes first

```text
A4 page at 2x on a phone-sized book box  ≈ 1400 × 1980 px × 4 bytes  ≈ 11 MB
Every page of a 1000-page book           ≈ 11 GB          → impossible
±4 pages around the current one (9)      ≈ 100 MB         → fine, and constant
```

==The number of live canvases must not depend on the length of the book.== Everything below follows from that.

## 2. Virtualization: the render window

```ts title="components/FlipReader/reader/Reader.tsx" principle="Windowing — O(1) memory in book length"
const active = renderOn && (Math.abs(i + lead - current) <= 4 || (pending !== null && Math.abs(i + lead - pending) <= 2));
```

- Pages inside the window draw; pages outside set `canvas.width = 0`, which releases the backing store immediately (removing the element would not, while React still holds it).
- **±4** pre-renders the next two spreads in both directions, so a normal flip never waits.
- **±2 around `pending`** pre-renders the target of a jump (search hit, multi-tap skip) before the animation lands.
- **Backpressure during fast flip:** at 4+ pages/second `renderOn` turns off. Rendering pages that are visible for 100 ms only wastes the worker.

This is the same idea as list virtualization (react-window), applied to a book.

## 3. Resolution as a level of detail

```text
scale = fit (CSS px per PDF unit) × min(devicePixelRatio, 2) × quality
quality = 1 normally, up to 4 when zoomed — but only for pages actually on screen
```

- Capping DPR at 2 saves 56 % of pixels on 3× phones with no visible loss at reading distance.
- Zoom raises quality only for visible pages, so zooming redraws 2 canvases, not 9.
- Hard caps protect against browser limits: `MAX_SIDE = 4096`, `MAX_PIXELS = 16 000 000`. Mobile Safari silently produces a blank canvas above its limit, which is the worst kind of bug.

## 4. Off the main thread

pdf.js parses and rasterises in a **Web Worker**. The main thread only receives finished pixels. Two other jobs are throttled with tiny semaphores so they never crowd out the visible page:

```ts title="lib/flipreader/thumbs.ts" principle="Counting semaphore — at most N jobs in flight"
const LIMIT = 3;
let running = 0;
const waiting: (() => void)[] = [];
```

- Thumbnails: 3 at a time, and only once they scroll into view (`IntersectionObserver`).
- Search text extraction: 3 pages at a time, only when search is opened.

## 5. Cancellation

Every render returns a task; the React effect's cleanup calls `task.cancel()` when the page leaves the window, resizes or changes zoom. pdf.js then rejects with `RenderingCancelledException`, which is expected and ignored. Without this, a fast reader queues dozens of stale renders and the visible page waits behind them (head-of-line blocking).

## 6. 60 fps page turning without React re-renders

The flip engine (`flip-book/html-flip-book.tsx`) is built on three choices:

- **One float, `f` = leaves turned.** A drag or animation only changes `f`; every leaf's `rotateY` is derived from it. Continuous state makes interrupting, reversing and chaining flips trivial.
- **`requestAnimationFrame` + direct `style.transform` writes** on DOM leaves with CSS 3D (`perspective`, `will-change: transform`). The compositor animates; React is not involved per frame.
- **Pointer capture + velocity hand-off.** When the finger lifts, the page continues at its current speed and eases out, so there is no stop-start.

Pinch-zoom (`useZoom.ts`) follows the same rule: transforms are written to the DOM during the gesture and committed to React state once at the end.

## 7. Perceived performance

- "Opening…" card with a spinner and per-file progress; per-page spinner until the first paint of that page.
- The first page is rendered as soon as the document's first page is parsed; nothing waits for the full file.
- Auto-flip timing reads word counts lazily and caches them in a `WeakMap` keyed by the PDF, so they are collected with it.

## 8. Memory lifecycle

| Resource | Released by | Failure if forgotten |
| --- | --- | --- |
| Off-window canvases | `canvas.width = 0` | Tab killed on mobile after ~50 pages |
| Stale renders | `task.cancel()` | Visible page waits behind old work |
| Page objects after thumbnails/text | `page.cleanup()` | Worker memory grows with pages visited |
| The whole document | `pdf.destroy()` on book change and unmount | Every PDF opened in the session stays resident |
| Derived data (word counts, page text) | `WeakMap` keyed by the PDF object | Leaks once the PDF is gone |

## 9. How to measure it

Chrome DevTools Performance (frame timeline during a held fast-flip), Memory panel heap snapshots before/after opening and leaving a 900-page PDF, and real devices for Safari's canvas limits. The key regression signal: memory after leaving the reader returns to its pre-open baseline.
