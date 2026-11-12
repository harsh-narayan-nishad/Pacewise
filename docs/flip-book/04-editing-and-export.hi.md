# Editing और export

Flip book users को PDF बदले बिना उसे restructure और annotate कैसे करने देती है, और vector text बचाने वाली merged PDF कैसे बनाती है।

## 1. Design goal

Edits तुरंत, undo करने लायक और export तक lossless होने चाहिए। असली files को **read-only inputs** माना जाता है; user जो भी करता है वह ऊपर रखा data है।

## 2. Immutable page list

```ts title="lib/flipreader/pages.ts" principle="Immutability + version counter — सस्ता undo और अपने आप cache invalidation"
export function withItems(doc: PagesDoc, items: PageItem[], extraSources: Source[] = []): PagesDoc {
    const known = new Set(doc.sources.map((s) => s.id));
    const sources = [...doc.sources, ...extraSources.filter((s) => !known.has(s.id))];
    return { ...doc, items, sources, pageCount: items.length, ratio: docRatio(items), rev: doc.rev + 1 };
}
```

- Add, move, duplicate और delete `items` array पर pure functions हैं।
- **Undo** पिछले arrays का bounded stack (40) है। Items versions के बीच shared हैं, इसलिए एक snapshot की कीमत pointers का एक array है, pages की copy नहीं।
- हर बदलाव पर `rev` बढ़ता है; search index और बाकी derived data उसी पर key करते हैं।
- Session के लिए sources append-only हैं, इसलिए undo हमेशा ऐसा page वापस ला सकता है जिसकी PDF अभी loaded है।

## 3. Non-destructive image edits

एक image page असली picture (एक बार 2400 px तक छोटी, JPEG) और एक `ImageEdit` value रखता है: rotate, flip, straighten, crop, brightness, contrast, saturation, warmth, sharpen, filter। Rendering edit लगाता है; export तक कुछ bake नहीं होता। यह Lightroom वाला model है: **pixels के ऊपर parameters**। फ़ायदे: edits reversible, store करने में सस्ते और resolution-independent हैं।

## 4. Overlays: resolution-independent annotations

Page पर रखे text, images, shapes और free-hand strokes अपनी position और size को **page के fractions (0–1)** और rotation के रूप में रखते हैं। इसलिए एक overlay thumbnail, 4× zoomed canvas और 2400 px export पर सही render होता है।

```text
drawOverlays(ctx, W, H, overlays)       lib/flipreader/overlays.ts
  ├─ book page (screen)
  ├─ page editor
  ├─ thumbnails
  └─ exported PDF
```

==हर surface के लिए एक renderer== ही editor को WYSIWYG बनाता है; चार अलग renderers धीरे-धीरे अलग हो जाते।

## 5. Export: जहाँ हो सके vectors रखो

```ts title="lib/flipreader/exportpdf.ts" principle="Original को बचाओ — PDF pages copy करो, सिर्फ़ ज़रूरी चीज़ rasterise करो"
const [page] = await out.copyPages(source, [item.index]);
out.addPage(page);
if (item.overlays.length) await stampOverlays(out, page, item.overlays, degrees);
```

| Page type | Strategy | Result |
| --- | --- | --- |
| असली PDF page | `pdf-lib` `copyPages` (object-level copy) | Vector text, selectable, असली size |
| Overlays वाला PDF page | Page copy, फिर page के size की एक transparent PNG stamp, rotation-aware | Original vector रहता है; overlays बिल्कुल screen जैसे |
| Image page | Edits + overlays को A4 size के page पर एक JPEG में render | Compact, faithful |

Overlay text को PDF text की जगह rasterise क्यों? pdf-lib में हर script (Devanagari, CJK, emoji) के fonts embed करना भारी और error-prone है; PNG stamp बिल्कुल वैसा print होता है जैसा दिखता है। **Trade-off:** overlay text selectable नहीं है।

## 6. Export के दौरान UI ज़िंदा रखना

- pdf-lib एक dynamic import है — सिर्फ़ पहले export पर download होता है।
- हर source PDF pdf-lib से **एक बार** parse होती है और उसके सारे pages के लिए दोबारा इस्तेमाल होती है (`Map` में memoised)।
- हर 4 pages पर loop event loop को रास्ता देता है (`setTimeout`), ताकि progress bar paint हो और input responsive रहे।
- Output एक `Blob` है जिसका object URL download के बाद revoke हो जाता है।

## 7. Covers state के रूप में, pages नहीं

Front और back covers एक छोटे `CoverDesign` object (title, colours, optional image) से बने pages हैं, जो हर book key के लिए size limits के साथ `localStorage` में रखे जाते हैं। वे सिर्फ़ देखने के लिए हैं और export नहीं होते — export user का content दिखाता है।

## 8. Defend करने के लिए तैयार रहने वाले trade-offs

| Choice | फ़ायदा | कीमत |
| --- | --- | --- |
| Source files कभी mutate न करना | Lossless, undo आसान | Export को सब कुछ फिर से जोड़ना पड़ता है |
| Overlay geometry के लिए fractions | हर resolution पर काम करता है | हर render पर conversions |
| Overlays के लिए PNG stamp | कोई भी script, pixel-exact | Overlay text selectable नहीं |
| Session-only edits | User files का कोई storage नहीं | Export न किया तो refresh पर edits खो जाते हैं |
