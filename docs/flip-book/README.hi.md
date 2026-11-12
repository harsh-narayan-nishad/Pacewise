# PDF Flip Book — engineering overview

एक browser-only PDF reader जो किसी भी PDF (300 MB तक, 1000+ pages) को असली काग़ज़ जैसी, पन्ने पलटने वाली book में बदलता है, साथ में full-text search, page editing और merged-PDF export। ==कोई server नहीं, कोई upload नहीं, mid-range phone पर चलता है।==

यह folder बताता है कि **यह कैसे बना है, क्या चुना गया और क्यों**, उसी तरह लिखा गया जैसे आप इसे senior system-design या front-end architecture interview में defend करेंगे।

## Documents

- [Architecture और requirements](01-architecture-and-requirements.md) — constraints, layers, data model, client-only का निर्णय
- [Rendering pipeline और performance](02-rendering-and-performance.md) — virtualization, memory budget, workers, cancellation, 60 fps gestures
- [Search system](03-search-system.md) — lazy indexing, two-level cache, offset maps, inverted index क्यों नहीं
- [Editing और export](04-editing-and-export.md) — immutable page model, non-destructive edits, vector बचाने वाला export
- [Security, reliability और interview playbook](05-security-reliability-interview.md) — threat model, failure modes, stories और संभावित सवाल

## एक paragraph में problem

Web पर लंबी PDFs पढ़ना या तो एक scrolling viewer है (काम का, थकाने वाला) या server-rendered flip book (upload चाहिए, पैसे लगते हैं, private documents leak होते हैं)। लक्ष्य था एक ऐसी flip book जो काग़ज़ जैसी लगे, textbook जितनी PDF तुरंत खोले, file कहीं न भेजे, और 3–4 GB RAM वाले phone पर smooth रहे।

## Architecture एक नज़र में

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

## मुख्य निर्णय

| निर्णय | सोचे गए विकल्प | यही क्यों | जो कीमत स्वीकार की |
| --- | --- | --- | --- |
| सब कुछ client-side | Server pages को images में render करे | Zero infra cost, design से ही privacy, upload latency नहीं | Device memory की सीमा; cross-device sync नहीं |
| pdf.js Web Worker में, lazy-loaded | Native `<embed>`, server PDF → image | Drawing, text और search पर पूरा control; ~400 KB सिर्फ़ ज़रूरत पर | बड़ी dependency जिसे pin और sync रखना है |
| अपना page-turn engine (CSS 3D + rAF) | Third-party flip library | Zoom-aware input, hold/tap gestures, motion blur, rotation चाहिए थे | Own और test करने के लिए ज़्यादा code |
| ±4 pages की render window | सारे pages render करो, या सिर्फ़ दिखने वाला | Bounded memory (book size में O(1)) और अगले flips पहले से तैयार | बहुत तेज़ jumps पर पल भर loader दिखता है |
| Cached page text पर linear scan | Inverted index | छोटा corpus (MBs), phrase search मुफ़्त, लगभग zero build cost | हर query O(total text); दसियों MB तक ठीक |
| Immutable page list + `rev` | Arrays को जगह पर mutate करना | सस्ता undo, आसान cache invalidation, React-friendly | हर edit पर नया array (pages shared हैं, इसलिए सस्ता) |
| Export पर `pdf-lib` से PDF pages copy | हर page rasterize करो | Vector text, छोटी files, selectable text | PDF pages पर overlays rasterize होते हैं |

## जानने लायक numbers

| मात्रा | Value | क्यों ज़रूरी |
| --- | --- | --- |
| 2× screen पर एक A4 page canvas | ≈ 1400 × 1980 × 4 B ≈ 11 MB | 1000 pages को ≈ 11 GB चाहिए होते |
| एक साथ canvas वाले pages | ≤ 9 (±4) और jump target के आसपास 5 | ≈ 100 MB की छत, book की लंबाई से स्वतंत्र |
| Canvas hard cap | 4096 px side, 16 M pixels (≈ 64 MB) | इसके ऊपर mobile Safari चुपचाप कुछ नहीं बनाता |
| Concurrency | 3 text extractions, 3 thumbnails | Worker व्यस्त रहता है पर दिखने वाला page भूखा नहीं रहता |
| Caches | Memory में 4 search indexes, IndexedDB में 8 books | LRU, bounded; storage fail हो तो दोबारा compute |

## रखने लायक principles

- **हर resource को design से bound करें**, उम्मीद से नहीं: canvases, concurrency, caches और file size सबकी स्पष्ट limits हैं।
- **Pure domain code, पतला React**: कठिन logic (`lib/flipreader/`) में React नहीं है, इसलिए वह testable और reusable है।
- **Shared math का एक source of truth**: search और highlight के लिए एक ही text normaliser; screen और export के लिए एक ही overlay renderer।
- **सब कुछ lazy**: pdf.js, pdf-lib और JSZip सिर्फ़ इस्तेमाल पर download होते हैं; text सिर्फ़ ज़रूरत पर निकाला जाता है।
- **Degrade करो, टूटो मत**: storage blocked, Fullscreen API नहीं, SVG backdrop filters unsupported — हर एक का fallback है।

## जिन anti-patterns से बचा गया

- "आसान बनाने" के लिए user files upload करना — इससे cost, latency और privacy liability आती है।
- "सरल है इसलिए" हर page का एक canvas रखना — यही mobile tabs को crash करता है।
- 60 fps gestures को React state से चलाना — हर frame पूरा tree re-render करेगा।
- Unpinned rendering libraries — library/worker version mismatch एक साथ हर PDF तोड़ देता है।
