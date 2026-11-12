# Performance, testing और reliability

Frontend को तेज़ क्या बनाता है, उसे कैसे test किया जाता है, चीज़ें विफल होने पर वह कैसा व्यवहार करता है, और क्या अभी भी कमज़ोर है। JD में "performance analysis", "unit/integration testing" और "ऊँचे quality मानक" माँगे गए हैं, इसलिए हर section इस पर ख़त्म होता है कि क्या मापना या सुधारना है।

## 1. Rendering performance

| तकनीक | कहाँ | असर |
|---|---|---|
| Progress को सच का स्रोत मानने वाला `requestAnimationFrame` loop | `hooks/useReadingEngine.ts` | हर frame में एक update; font बदलने पर प्रतिशत कभी नहीं उछलता |
| Track पर `ResizeObserver` | वही | Reflow पर सिर्फ़ scroll की जगह दोबारा निकालता है |
| 4 सेकंड की चलती WPM खिड़की | वही | हर sample रखे बिना smooth speedometer |
| State और dispatch के अलग contexts | `contexts/ReadingContext.tsx` | सिर्फ़ dispatch करने वाले components state बदलने पर कभी re-render नहीं होते |
| `useSyncExternalStore` | stores, session, toasts | Concurrent rendering में एक जैसे reads |
| 6 के पन्नों में infinite scroll | `components/Feed/PersonalizedFeed.tsx` | छोटा पहला render; sentinel दिखने पर ही और cards |
| Virtualised पन्ने, worker parsing, LRU caches, cancellation | `lib/flipreader`, `components/FlipReader` | बड़ी PDFs smooth रहती हैं; देखें [Rendering और performance](../flip-book/02-rendering-and-performance.md) |
| Lazy Mermaid और search index | `components/Notes/MermaidViewer.tsx`, `DocSearch.tsx` | भारी code तभी आता है जब diagram या search box इस्तेमाल हो |
| 150 ms के बाद ही navigation loader | `contexts/NavLoaderContext.tsx` | तेज़ पेज कभी spinner नहीं चमकाते |
| `passive: true` activity listeners | `PresenceTracker` | Heartbeat के listeners scroll को कभी नहीं रोकते |

## 2. Loading performance और Core Web Vitals

- **LCP (Largest Contentful Paint):** landing hero और video। Video पर `preload="metadata"` और poster image लगाएँ; images आधुनिक formats में दें।
- **INP (Interaction to Next Paint):** लंबे tasks दुश्मन हैं। हर social action के बाद synchronous `localStorage` snapshot write मुख्य जोखिम है; उसे debounce करें या IndexedDB पर ले जाएँ।
- **CLS (Cumulative Layout Shift):** cards और avatars के तय आकार; gate का खाली पहला paint hydration से layout उछलने से बचाता है।
- **Fonts:** `preconnect` और `display=swap` के साथ Google Fonts। `next/font` से self-host करने पर रोकने वाला third-party request हट जाता है।
- **Caching:** hash वाली `/_next/static` files लंबे समय तक cache होती हैं; `next.config.js` में `/videos/*` को `max-age=31536000, immutable` मिलता है।
- **Code splitting:** हर route अपना chunk है; pdf.js और Mermaid ज़रूरत पर load होते हैं।

**कैसे मापें:** Chrome DevTools का Performance panel (लंबे tasks, main-thread flame chart), lab numbers के लिए Lighthouse, analytics को भेजे जाने वाले field numbers के लिए `web-vitals` library, बेकार renders के लिए React DevTools Profiler, और flip book में leaks के लिए Memory panel (heap snapshots)।

## 3. Testing

| स्तर | क्या मौजूद है | कैसे चलता है |
|---|---|---|
| Unit | Editor (55), session isolation (23), docs (15), presence (8), quiz (8), time log (8), topics (4) में कुल 121 tests | `npx tsx scripts/<name>.test.ts`; `npm test` editor + session चलाता है |
| Type checks | पूरे app पर `strict` TypeScript | `npm run typecheck` |
| Docs checks | Renderer सुरक्षा tests; हिंदी parity checker | `scripts/docs.test.ts`, `node scripts/check-hi-docs.mjs` |
| Lint | Next.js ESLint config, CI में चलता है, build में नहीं | `npm run lint` |

Code को testable क्या बनाता है: React के बाहर शुद्ध logic, बाहर से दी गई घड़ियाँ (`ReadingPresence` `now` लेता है), बाहर से दी गई storage (`MemoryKeyValueStore`), और बाहर से दी गई पहचान (`IdentityProvider`)।

**ज्ञात कमी:** `npm run typecheck` अभी `scripts/editor.test.ts` में तीन errors दिखाता है (`.data` से पहले `Promise<ExportResult>` union await नहीं हुआ)। App का अपना code type-check हो जाता है।

**एक senior आगे क्या जोड़ेगा:**
- Sign-in gate, comment panel और quiz के लिए React Testing Library से component tests।
- Playwright से end-to-end tests: sign in, पढ़ना, quiz पूरा करना, history देखना; एक account से like, दूसरे पर notification देखना।
- `lib/api/endpoints.ts` और backend के OpenAPI schema के बीच contract tests।
- एक CI pipeline: typecheck, lint, unit tests, हिंदी parity check, build, Lighthouse budget।

## 4. विफलता संभालना

| विफलता | व्यवहार |
|---|---|
| Backend सोया या बंद | UI local data से चलता रहता है; sync और tracking queue में रहते हैं; demo accounts offline sign in कर सकते हैं; sign-in screen "Backend not connected" कहती है |
| Access token की समय-सीमा ख़त्म | एक साझा refresh, फिर मूल request एक बार दोबारा |
| Refresh token अमान्य | Tokens हटे; व्यक्ति sign out |
| Sign in रहते account banned | `ACCOUNT_*` code वाला `403` session हटाकर reload करता है |
| `localStorage` भरा या blocked | Writes `try/catch` में लिपटी हैं; app session भर memory में चलता है |
| ख़राब रखा गया JSON | Repositories crash की जगह खाली मान पर लौटती हैं |
| Render crash | `app/error.tsx` और `app/global-error.tsx` recovery screen दिखाते हैं |
| Session के बीच tab बंद | Tracking queue रखी जाती है; `pagehide` presence flush करता है; autosave छिपने पर flush होता है |
| दो tabs एक document edit कर रहे | Lease lock: जो tab उसे नहीं पा सकता वह document read-only खोलता है |
| पढ़ते समय laptop सो जाए | Presence हर beat पर ज़्यादा से ज़्यादा दो heartbeats जितना समय जोड़ता है |

## 5. Security checklist (frontend की तरफ़)

- हर जगह HTTPS; tokens कभी log नहीं होते।
- `next.config.js` में security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` (clickjacking), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` जो सिर्फ़ microphone की अनुमति देता है (आवाज़ से search); `X-Powered-By` हटाया गया।
- हर story HTML editor के sanitiser से गुज़रता है; docs Markdown पहले escape होता है और `javascript:` links हटाए जाते हैं।
- `robots.ts` account और पढ़ने वाले पेजों को search engines से बाहर रखता है।
- बाकी काम: Content-Security-Policy जोड़ना; refresh token को httpOnly cookie में ले जाना; query string में SSE token कम समय का, एक ही काम वाला token होना चाहिए।

## 6. Observability (क्या जोड़ना है)

- Error boundaries और `ApiError`s से client error reporting (जैसे Sentry)।
- Web Vitals और custom timings (पहली story तक समय, quiz पूरा करने की दर) analytics को भेजना।
- Sync status indicator: `backendSync` पहले से `subscribe` / `getStatus` (`off`, `connecting`, `online`, `offline`) देता है।
- A/B tests के लिए experiment flags (onboarding का text, feed ranking) exposure logging के साथ, ताकि पूरा rollout करने से पहले product बदलाव मापा जा सके।
