# Architecture और requirements

Requirements ने PDF flip book की architecture को कैसे आकार दिया, और हर layer के पीछे का तर्क।

## 1. Requirements

| प्रकार | Requirement |
| --- | --- |
| Functional | PDFs (और images, EPUB, text) को असली page turn वाली two-page book की तरह खोलना |
| Functional | पूरी book में search, hit पर jump, page पर उसे highlight करना |
| Functional | Pages को reorder, add, delete और annotate करना; नतीजा एक PDF के रूप में download |
| Non-functional | Mid-range phone पर typical PDF का पहला page ~1 s से कम में दिखे |
| Non-functional | Page count (1000+ pages) चाहे जो हो, memory bounded रहे |
| Non-functional | 60 fps page drag; pages render होते समय कोई jank नहीं |
| Non-functional | File कभी device नहीं छोड़ती; load होने के बाद offline चलता है |
| Out of scope | Accounts, cloud sync, OCR, real-time collaboration |

## 2. सबसे बड़ा निर्णय: सिर्फ़ client

Server-side design (upload → worker fleet पर pages को images में render → CDN से serve) flip-book SaaS का textbook जवाब है। यहाँ उसे मना किया गया:

- **Privacy**: users notes, textbooks और personal documents खोलते हैं। उन्हें store न करने से risk की पूरी class हट जाती है (breach, retention, compliance)।
- **Cost**: 1000 pages की PDF को दो resolutions पर rasterise करना हर upload पर मिनटों का CPU और gigabytes का storage है। Client-side cost zero है और users के साथ मुफ़्त में scale होता है।
- **Latency**: पढ़ना शुरू करने से पहले 100 MB file का upload नहीं।

**स्वीकार किया trade-off:** हमें device की सीमाएँ (memory, CPU, browser quirks) मिलती हैं, इसलिए बाकी design client पर किफ़ायती रहने के बारे में है। Cross-device continuity के लिए अलग design चाहिए (interview playbook देखें)।

## 3. Layers

```text
app/flipbook/page.tsx        Route shell. Opens handed-off files or redirects. Full screen, no app chrome.
Reader.tsx                   Controller: owns state, wires input → engine, lifecycle (open / release).
flip-book/                   View: page-turn engine. DOM leaves + CSS 3D, rAF animation, pointer capture.
reader/pages.tsx             View: one page = one canvas (PDF), image or text block.
lib/flipreader/*             Domain: loaders, search, text maps, overlays, export, gestures. No React.
pdf.js worker                Parsing and rasterising off the main thread.
```

यह बँटवारा क्यों मायने रखता है:

- **बिना React का domain** — `gestures.ts` (tap-skip और hold-flip timing), `search.ts`, `pdftext.ts` सादे functions और classes हैं। इन्हें Node में unit-test किया जा सकता है और UI छुए बिना tune किया जा सकता है।
- **Engine React state से नहीं, एक mutable state object से पढ़ता है** — timers और pointer handlers कभी पुराने props पर close नहीं करते; React सिर्फ़ तब re-render करता है जब कुछ दिखने वाला बदले।
- **Modules के पार side effects सिर्फ़ Controller में** — opening, releasing, keyboard, theme। Lifetimes समझना आसान।

## 4. Data model

```ts title="lib/flipreader/types.ts" principle="Indirection: pages shared sources की ओर इशारा करते हैं; sources कभी copy नहीं होते"
export type PdfItem = { id: string; type: 'pdf'; src: PdfSource; index: number; overlays: Overlay[] };
export type ImageItem = { id: string; type: 'image'; src: ImageSource; edit: ImageEdit; overlays: Overlay[] };
export type PageItem = PdfItem | ImageItem;
```

- **Sources बनाम items।** एक `PdfSource` parsed document को एक बार रखता है; हर page एक छोटा `PdfItem` है जो `(source, index)` की ओर इशारा करता है। एक book में कई PDFs और images मिलाना, pages reorder या duplicate करना कुछ bytes का खर्च है, दोबारा parse कभी नहीं (flyweight idea)।
- **`rev` के साथ immutable `PagesDoc`।** हर edit एक नया document बनाता है जिसका `rev` बढ़ता है। Undo पिछले `items` arrays का एक stack है (structural sharing: item objects दोबारा इस्तेमाल होते हैं)। Caches `doc.key + rev` पर key करते हैं, इसलिए invalidation अपने आप होता है।
- **Stable book identity।** हर file का `key = hash(name | size | lastModified)`। Per-book state (cover design, cached text) file store किए बिना reloads के बाद भी बचा रहता है।
- **हर जगह discriminated unions** (`kind`, `type`) — compiler हर renderer और exporter को हर page type संभालने पर मजबूर करता है।

## 5. Screens के बीच `File` ले जाना

Search bar और reader अलग routes हैं। `File` URL या Web Storage से नहीं जा सकती, और upload नहीं होनी चाहिए। Hand-off एक module-level variable है, जो एक बार पढ़ा जाता है (`takePendingFiles()`), जो एक SPA session के अंदर काम करने वाली सबसे सरल चीज़ है। Refresh पर यह design से खो जाता है, इसलिए route खाली reader दिखाने की जगह home पर redirect करता है।

## 6. Code splitting

```ts title="lib/flipreader/loaders.ts" principle="Dependency की कीमत तभी चुकाओ जब feature इस्तेमाल हो"
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker-${pdfjs.version}.min.mjs`;
```

pdf.js (~400 KB), pdf-lib (export) और JSZip (EPUB) सब dynamic imports हैं, इसलिए बाकी Pacewise इन्हें कभी download नहीं करता।

## 7. 10× / 100× पर क्या बदलता है

| दबाव | अगला कदम |
| --- | --- |
| 5 000+ pages की books | Text extraction और search को dedicated worker में ले जाएँ; index stream करें |
| कमज़ोर devices | कम `devicePixelRatio` cap, छोटी window (±2), JPEG-backed page cache |
| Cross-device reading | Server पर सिर्फ़ metadata (position, highlights) रखें, content hash से keyed |
| Shared annotations | Overlays के पास पहले से stable ids और normalised coordinates हैं — हर page पर एक CRDT list fit होती है |
| Scanned books | मौजूदा text interface के पीछे on-device OCR (WASM), ताकि search में कोई बदलाव न हो |
