# Editing and export

How the flip book lets users restructure and annotate a PDF without ever modifying it, and how it produces a merged PDF that keeps vector text.

## 1. Design goal

Edits must be instant, undoable and lossless until export. The original files are treated as **read-only inputs**; everything the user does is data layered on top.

## 2. Immutable page list

```ts title="lib/flipreader/pages.ts" principle="Immutability + version counter — cheap undo and automatic cache invalidation"
export function withItems(doc: PagesDoc, items: PageItem[], extraSources: Source[] = []): PagesDoc {
    const known = new Set(doc.sources.map((s) => s.id));
    const sources = [...doc.sources, ...extraSources.filter((s) => !known.has(s.id))];
    return { ...doc, items, sources, pageCount: items.length, ratio: docRatio(items), rev: doc.rev + 1 };
}
```

- Add, move, duplicate and delete are pure functions over the `items` array.
- **Undo** is a bounded stack (40) of previous arrays. Items are shared between versions, so a snapshot costs one array of pointers, not a copy of pages.
- `rev` increments on every change; the search index and other derived data key on it.
- Sources are append-only for the session, so an undo can always bring back a page whose PDF is still loaded.

## 3. Non-destructive image edits

An image page stores the original (downscaled once to 2400 px, JPEG) plus an `ImageEdit` value: rotate, flip, straighten, crop, brightness, contrast, saturation, warmth, sharpen, filter. Rendering applies the edit; nothing is baked in until export. This is the same model as Lightroom: **parameters over pixels**. Benefits: edits are reversible, cheap to store and resolution-independent.

## 4. Overlays: resolution-independent annotations

Text, images, shapes and free-hand strokes placed on a page store position and size as **fractions of the page (0–1)** plus rotation. One overlay therefore renders correctly on a thumbnail, a zoomed 4× canvas and a 2400 px export.

```text
drawOverlays(ctx, W, H, overlays)       lib/flipreader/overlays.ts
  ├─ book page (screen)
  ├─ page editor
  ├─ thumbnails
  └─ exported PDF
```

==One renderer for every surface== is what makes the editor WYSIWYG; four separate renderers would drift apart.

## 5. Export: keep vectors where possible

```ts title="lib/flipreader/exportpdf.ts" principle="Preserve the original — copy PDF pages, rasterise only what must be"
const [page] = await out.copyPages(source, [item.index]);
out.addPage(page);
if (item.overlays.length) await stampOverlays(out, page, item.overlays, degrees);
```

| Page type | Strategy | Result |
| --- | --- | --- |
| Original PDF page | `pdf-lib` `copyPages` (object-level copy) | Vector text, selectable, original size |
| PDF page with overlays | Copy page, then stamp one transparent PNG the size of the page, rotation-aware | Original stays vector; overlays exact as on screen |
| Image page | Render edits + overlays into one JPEG on an A4-sized page | Compact, faithful |

Why rasterise overlay text instead of writing PDF text? Embedding fonts for every script (Devanagari, CJK, emoji) in pdf-lib is heavy and error-prone; a PNG stamp prints exactly as seen. **Trade-off:** overlay text is not selectable.

## 6. Keeping the UI alive during export

- pdf-lib is a dynamic import — downloaded only on the first export.
- Each source PDF is parsed by pdf-lib **once** and reused for all its pages (memoised in a `Map`).
- Every 4 pages the loop yields to the event loop (`setTimeout`), so the progress bar paints and input stays responsive.
- The output is a `Blob` with an object URL that is revoked after download.

## 7. Covers as state, not pages

Front and back covers are generated pages driven by a small `CoverDesign` object (title, colours, optional image), persisted per book key in `localStorage` with size limits. They are view-only and not exported — the export reflects the user's content.

## 8. Trade-offs to be ready to defend

| Choice | Benefit | Cost |
| --- | --- | --- |
| Never mutate source files | Lossless, undo is trivial | Export must recombine everything |
| Fractions for overlay geometry | Works at every resolution | Conversions at each render |
| PNG stamp for overlays | Any script, pixel-exact | Overlay text not selectable |
| Session-only edits | No storage of user files | Edits are lost on refresh unless exported |
