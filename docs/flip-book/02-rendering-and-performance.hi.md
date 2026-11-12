# Rendering pipeline और performance

1000 pages की PDF phone पर smooth कैसे रहती है: memory budget, virtualization, main thread से बाहर काम, cancellation और gesture handling।

## 1. Memory budget सबसे पहले

```text
A4 page at 2x on a phone-sized book box  ≈ 1400 × 1980 px × 4 bytes  ≈ 11 MB
Every page of a 1000-page book           ≈ 11 GB          → impossible
±4 pages around the current one (9)      ≈ 100 MB         → fine, and constant
```

==Live canvases की संख्या book की लंबाई पर निर्भर नहीं होनी चाहिए।== नीचे सब कुछ इसी से निकलता है।

## 2. Virtualization: render window

```ts title="components/FlipReader/reader/Reader.tsx" principle="Windowing — book की लंबाई में O(1) memory"
const active = renderOn && (Math.abs(i + lead - current) <= 4 || (pending !== null && Math.abs(i + lead - pending) <= 2));
```

- Window के अंदर के pages बनते हैं; बाहर के pages `canvas.width = 0` set करते हैं, जो backing store तुरंत छोड़ देता है (element हटाने से नहीं होता, जब तक React उसे पकड़े है)।
- **±4** दोनों दिशाओं में अगले दो spreads पहले से बना देता है, इसलिए normal flip कभी इंतज़ार नहीं करता।
- **`pending` के आसपास ±2** jump के target (search hit, multi-tap skip) को animation पहुँचने से पहले बना देता है।
- **Fast flip के दौरान backpressure:** 4+ pages/second पर `renderOn` बंद हो जाता है। 100 ms दिखने वाले pages render करना सिर्फ़ worker बर्बाद करता है।

यह वही idea है जो list virtualization (react-window) का है, एक book पर लगाया गया।

## 3. Resolution एक level of detail के रूप में

```text
scale = fit (CSS px per PDF unit) × min(devicePixelRatio, 2) × quality
quality = 1 normally, up to 4 when zoomed — but only for pages actually on screen
```

- DPR को 2 पर cap करने से 3× phones पर 56 % pixels बचते हैं, पढ़ने की दूरी पर कोई दिखने वाला नुकसान नहीं।
- Zoom सिर्फ़ दिख रहे pages की quality बढ़ाता है, इसलिए zoom करने पर 2 canvases दोबारा बनते हैं, 9 नहीं।
- Hard caps browser limits से बचाते हैं: `MAX_SIDE = 4096`, `MAX_PIXELS = 16 000 000`। Mobile Safari अपनी limit के ऊपर चुपचाप खाली canvas बनाता है, जो सबसे बुरे प्रकार का bug है।

## 4. Main thread से बाहर

pdf.js एक **Web Worker** में parse और rasterise करता है। Main thread को सिर्फ़ तैयार pixels मिलते हैं। दो और jobs छोटे semaphores से throttle होते हैं ताकि वे दिखने वाले page को कभी न दबाएँ:

```ts title="lib/flipreader/thumbs.ts" principle="Counting semaphore — एक साथ ज़्यादा से ज़्यादा N jobs"
const LIMIT = 3;
let running = 0;
const waiting: (() => void)[] = [];
```

- Thumbnails: एक साथ 3, और सिर्फ़ जब वे scroll होकर दिखें (`IntersectionObserver`)।
- Search text extraction: एक साथ 3 pages, सिर्फ़ जब search खोला जाए।

## 5. Cancellation

हर render एक task लौटाता है; React effect का cleanup `task.cancel()` बुलाता है जब page window छोड़ता है, resize होता है या zoom बदलता है। तब pdf.js `RenderingCancelledException` से reject करता है, जो अपेक्षित है और ignore होता है। इसके बिना, तेज़ reader दर्जनों पुराने renders queue कर देता है और दिखने वाला page उनके पीछे इंतज़ार करता है (head-of-line blocking)।

## 6. React re-renders के बिना 60 fps page turning

Flip engine (`flip-book/html-flip-book.tsx`) तीन choices पर बना है:

- **एक float, `f` = पलटे गए leaves।** Drag या animation सिर्फ़ `f` बदलता है; हर leaf का `rotateY` उसी से निकलता है। Continuous state से flips को रोकना, उलटना और जोड़ना आसान हो जाता है।
- **`requestAnimationFrame` + सीधे `style.transform` writes** CSS 3D (`perspective`, `will-change: transform`) वाले DOM leaves पर। Compositor animate करता है; हर frame पर React शामिल नहीं होता।
- **Pointer capture + velocity hand-off।** उँगली उठने पर page अपनी मौजूदा speed से चलता रहता है और धीरे रुकता है, इसलिए कोई stop-start नहीं।

Pinch-zoom (`useZoom.ts`) भी यही नियम मानता है: gesture के दौरान transforms DOM में लिखे जाते हैं और अंत में एक बार React state में commit होते हैं।

## 7. Perceived performance

- Spinner और per-file progress वाला "Opening…" card; हर page पर उसके पहले paint तक spinner।
- Document का पहला page parse होते ही पहला page render होता है; पूरी file का इंतज़ार कुछ नहीं करता।
- Auto-flip timing word counts को lazily पढ़ता है और PDF से keyed `WeakMap` में cache करता है, ताकि वे उसके साथ collect हो जाएँ।

## 8. Memory lifecycle

| Resource | किससे release | भूल गए तो failure |
| --- | --- | --- |
| Window से बाहर के canvases | `canvas.width = 0` | ~50 pages के बाद mobile पर tab killed |
| पुराने renders | `task.cancel()` | दिखने वाला page पुराने काम के पीछे इंतज़ार करता है |
| Thumbnails/text के बाद page objects | `page.cleanup()` | Visit किए pages के साथ worker memory बढ़ती है |
| पूरा document | Book बदलने और unmount पर `pdf.destroy()` | Session में खोली हर PDF memory में रहती है |
| Derived data (word counts, page text) | PDF object से keyed `WeakMap` | PDF जाने के बाद leak |

## 9. इसे कैसे मापें

Chrome DevTools Performance (held fast-flip के दौरान frame timeline), 900 pages की PDF खोलने और छोड़ने से पहले/बाद Memory panel heap snapshots, और Safari की canvas limits के लिए असली devices। मुख्य regression signal: reader छोड़ने के बाद memory खोलने से पहले वाले baseline पर लौट आए।
