# Security, reliability और interview playbook

PDF flip book का threat model और failure handling, और उसके बाद senior engineering interview में project को कैसे पेश करें।

## 1. Threat model

| Threat | Mitigation |
| --- | --- |
| Malicious PDF code चलाए (PDF JavaScript, font programs) | `isEvalSupported: false`; Web Worker में parsing; pdf.js कभी document scripts नहीं चलाता |
| Private document leak होना | File कभी upload या store नहीं होती; सिर्फ़ निकाला गया text (search के लिए) locally cache होता है, LRU-bounded |
| File names या text से script injection | Text nodes या canvas pixels के रूप में render; document content से कोई `innerHTML` नहीं |
| Supply-chain / CDN tampering | pdf.js worker, character maps और fonts `public/` से self-hosted, build time पर copy |
| बहुत बड़ी या बनाई गई file tab freeze करे | Size limits (PDF 300 MB, image 40 MB), canvas caps, concurrency limits, cancellable काम |
| Clickjacking / framing | App-wide security headers (`X-Frame-Options`, `nosniff`, HSTS, COOP) |

## 2. Reliability feature के रूप में version pinning

```ts title="lib/flipreader/loaders.ts" principle="Worker URL में library version है — mismatch असंभव"
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker-${pdfjs.version}.min.mjs`;
```

Library और worker के versions अलग हों तो pdf.js चलने से मना करता है, जिससे एक साथ **हर** PDF टूट जाती। Package exact version पर pinned है, और build script उसी version के नाम की worker file लिखता है, इसलिए पुराना cached worker कभी नहीं उठता।

## 3. Failure modes और graceful degradation

| Failure | व्यवहार |
| --- | --- |
| Password-protected या खराब PDF | साफ़, इंसानी error message; batch की बाकी files फिर भी खुलती हैं |
| एक page render होने में fail | Error log होता है और उस page पर loader बना रहता है; बाकी book चलती है |
| IndexedDB blocked या भरा | Search फिर भी चलता है; text दोबारा compute होता है |
| Fullscreen API नहीं (iOS Safari) | CSS "window भरो" fallback |
| SVG backdrop filters unsupported | Glass controls blur + tint पर fallback |
| Session के बीच page refresh | खाली screen की जगह home पर redirect (design से `File` चली गई) |

## 4. Accessibility और UX quality

- `prefers-reduced-motion`: 120 ms flips, कोई motion blur नहीं, धीमे spinners।
- Loading और errors के लिए `aria-live` page announcements और status regions।
- पूरा keyboard model (arrows, space, search, full screen, escape)।
- Theme host app (dark / light / sepia) के साथ CSS variables से चलता है, reader container तक सीमित।

## 5. Testing strategy

- **Pure domain modules** (gestures, search, text normalisation, pagination) Node में unit-testable हैं क्योंकि उनमें कोई React या DOM dependency नहीं।
- **Manual matrix** जो असली regressions पकड़ता है: छोटी PDF, 900 pages की PDF, scanned PDF, बिना embedded fonts वाली PDF, password-protected PDF; Chrome, Safari iOS, Android Chrome।
- **Memory regression check**: reader छोड़ने के बाद heap snapshot baseline पर लौटे।
- अगला कदम: fixed PDFs पर Playwright visual tests, और CI में performance budget (पहले page तक का time, peak memory)।

## 6. Interview playbook

### 30-second pitch

"I built a browser-only PDF flip-book reader. It opens 300 MB, 1000-page PDFs on a phone with constant memory by virtualising page canvases, keeps 60 fps page turns by animating outside React, searches the full text with a two-level cache, and exports a merged PDF that keeps vector text. Nothing is uploaded, so it costs nothing to run and is private by design."

### दो मिनट का deep dive (एक चुनें)

1. **Memory**: हर page canvas 11 MB → windowing (±4) → Safari के लिए hard caps → lifecycle (`cancel`, `cleanup`, `destroy`, `WeakMap`) → heap snapshots से जाँचें।
2. **Search**: इस size पर linear scan inverted index से बेहतर क्यों → `rev` invalidation के साथ per-source caching → search और highlight के लिए एक normaliser → highlight रखने के लिए affine transforms।
3. **Export**: immutable model → vectors बचाने के लिए `copyPages` → script fidelity के लिए overlays rasterised → responsiveness के लिए yielding।

### Stories (STAR)

हर row वह problem है जिसे रोकने के लिए code में एक guard है। ==इसे सिर्फ़ उतना ही बताएँ जितना आपने सच में देखा और मापा==, और अपने numbers इस्तेमाल करें।

| Situation | Action | Result |
| --- | --- | --- |
| बड़ी PDFs पर हर page का एक canvas memory खत्म कर देता है (mobile tabs kill होते हैं) | हर canvas की cost निकाली, render window, `canvas.width = 0` और pixel caps लाए | Book की लंबाई चाहे जो हो, memory flat |
| पुराने pdf.js version की बची worker file एक साथ हर PDF तोड़ देती है | Worker URL में library version डाला | Exact pinning + version के नाम वाली worker file; bug की पूरी class खत्म |
| पहले के एक feature में बड़े uploads चुपचाप data खो देते थे | पता चला कि storage quota failures चुपचाप होते हैं | नियम: user files कभी Web Storage में नहीं; flip book files सिर्फ़ memory में रखती है |
| Fast flipping उन pages के renders queue करता है जो जा चुके हैं | Page window छोड़े तो उसका render cancel; 4 pages/s से ऊपर rendering रोकी | दिखने वाला page कभी पुराने काम के पीछे इंतज़ार नहीं करता |

### संभावित सवाल

| सवाल | मज़बूत जवाब, संक्षेप में |
| --- | --- |
| Server पर render क्यों नहीं? | Cost, privacy और latency; trade-off device limits हैं, सख़्त budgets से संभाले गए |
| Bounded memory की guarantee कैसे? | Windowing + caps + explicit release; memory O(window) है, O(pages) नहीं |
| Inverted index क्यों नहीं? | Corpus MBs का है; scan ms का है और phrases support करता है; switch point दसियों MB या fuzzy search है |
| Cross-device sync कैसे जोड़ेंगे? | सिर्फ़ metadata (position, highlights, overlays) sync करें, content hash से keyed; file कभी नहीं |
| Collaborative annotations कैसे support करेंगे? | Overlays के पास पहले से ids और normalised coordinates हैं; WebSocket पर हर page का एक CRDT |
| 5 लोगों की team के साथ क्या बदलेंगे? | Worker-based search, OCR, CI में Playwright + perf budgets, render times की telemetry |
| इस design का सबसे बड़ा risk? | Browser-specific limits (canvas size, memory); caps, fallbacks और device testing से कम किया |

### यह project कौन से signals दिखाता है

- Back-of-the-envelope estimation से design (code से पहले memory budget)।
- सबसे सरल data structure चुनना जो latency budget पूरा करे, और जानना कि वह कब काफ़ी नहीं रहता।
- Pure domain logic को UI से साफ़ अलग रखना, जिससे testing और reuse आसान हो।
- Trade-offs को छिपाने की जगह खुलकर own करना।
