# Component के हिसाब से CS fundamentals

चार मुख्य विषय (Computer Networks, Operating Systems, DBMS, OOP) frontend के **हर component** से जोड़े गए हैं। विषय के हिसाब से पेज Core CSE में पहले से हैं; यह पेज दूसरी धुरी है: कोई component चुनें, उसमें इस्तेमाल हुआ हर concept देखें।

विषय के हिसाब से पेज: [CN](../syllabus/04-core-cse/cn/01-frontend.md) · [OS](../syllabus/04-core-cse/os/01-frontend.md) · [DBMS](../syllabus/04-core-cse/dbms/01-frontend.md) · [OOPs](../syllabus/04-core-cse/oops/01-frontend.md)।

## 1. Matrix

| Component | CN | OS | DBMS | OOP |
|---|---|---|---|---|
| `lib/api/client.ts` | HTTPS, JSON, Bearer auth, status codes, CORS pre-flight | Mutex के रूप में Promise (single-flight) | — | `Error` की subclass `ApiError` |
| `lib/api/AuthContext.tsx` | Token refresh, सोए server को जगाने वाला health ping | Races से बचने के लिए effect cleanup flag | Session की वैधता जाँच (`/auth/me`) | एक interface देने वाला provider context |
| `ScopedTokenStore` | — | Per-user isolation (per-process credentials जैसा) | Key namespacing | Encapsulation, बाहर से दी गई dependencies |
| `backendSync` | Debounce, batching, polling, visibility से होने वाले pulls | Timers, background throttling, re-entrancy guard (`busy`/`again`) | Change data capture, baseline diff, tombstones, sequence cursor, last-write-wins | Private state वाली singleton class |
| `backendTracking` | 100 के batches, विफलता पर retry | Tab बंद होने के बाद भी बची रहने वाली queue | Idempotency key (`opId`), exactly-once असर | Encapsulated queue |
| `SyncingKeyValueStore` | Uploads शुरू करता है | — | पहले link पर reconcile (upload या restore) | Decorator |
| `lib/session/*` | — | Per-user directories जैसे namespaces | Repositories के रूप में tables, schema version `v2`, एक बार का migration | Template Method, Repository, Value Object, Facade |
| `devDataStore` | — | Synchronous `localStorage` write main thread रोकती है | Unique (contentId, userId), playlists के लिए join table, delete पर cascade, हर action पर एक snapshot write | Observer, Singleton |
| `ReadingContext` | — | — | — | Reducer से state machine |
| `useReadingEngine` | — | `requestAnimationFrame` scheduling, frame समय `dt`, `ResizeObserver` | — | Strategy (शुद्ध WPM functions) |
| `readingPresence` / `PresenceTracker` | — | Heartbeat, idle timeout, रुके timers के लिए clamp, `performance.now()` monotonic घड़ी | Per-user चलता कुल समय | बाहर से दी गई storage और घड़ी वाला model |
| `EditLock` | — | Timeout वाला lease lock, deadlock नहीं, race दोबारा पढ़कर सुलझता है | Lost-update से बचाव | Encapsulated lock |
| `AutosaveScheduler` | — | Write-back cache / write coalescing, छिपने पर flush | Durability point | Generic class `AutosaveScheduler<T>` |
| `HtmlSanitizer` | Network से आए content की भरोसा सीमा | — | — | Policy object (`SanitizePolicy`) |
| `lib/flipreader/*` | pdf.js worker की lazy loading | Worker thread, memory budget, virtualisation (demand paging), cancellation | Invalidation के साथ IndexedDB text cache | Immutable page list, data के रूप में overlays |
| `mediaStory` | — | File picker sandbox; parsing के लिए worker thread | — | Adapter: media एक `StoryData` बनती है |
| `landingMedia`, `thumbnailVideo` | — | Main heap के बाहर blob storage | IndexedDB object store, transactions | छोटी module API |
| `lib/qr.ts` | Network coding जैसी error correction (Reed-Solomon) | — | — | शुद्ध functions |
| `NotificationBell` | Data polling से आता है; SSE hook तैयार | — | Unread count rows से निकाला जाता है | Store के ज़रिए Observer |
| `PersonalizedFeed` | पन्नों में loading (`IntersectionObserver`) | — | मिलते attributes से ranking | Props वाला दोबारा इस्तेमाल होने लायक component |
| Docs site (`lib/docs`) | Build-time bundling, ज़रूरत पर search index | — | Inverted जैसा section index | Options वाला renderer |
| `next.config.js` | Security और cache headers | — | — | — |

## 2. CN गहराई में: Pacewise से एक request

1. **DNS** backend host ढूँढता है; **TCP** handshake; **TLS** handshake (certificate जाँच, key exchange)।
2. Cross-origin call: `Authorization` और `Content-Type: application/json` headers की वजह से browser एक `OPTIONS` **pre-flight** भेजता है। Server frontend के origin के लिए `Access-Control-Allow-Origin` से जवाब देता है।
3. असली request: `Authorization: Bearer <access token>`, JSON body।
4. Client जिन status codes को संभालता है: `200/201`, `204` (कोई body नहीं), `401` (refresh + retry), `403` (banned: sign out), `4xx` (संदेश दिखाओ), `5xx` / network error (data queue में रखो, retry)।
5. **Keep-alive** बाद के requests के लिए connection दोबारा इस्तेमाल करता है; **HTTP/2** एक connection पर कई requests multiplex करता है।
6. Real-time के विकल्प: polling (इस्तेमाल), SSE (तैयार), WebSocket (ज़रूरत नहीं)। SSE एक लंबा HTTP response इस्तेमाल करता है; `EventSource` headers set नहीं कर सकता, इसलिए token URL में जाता है और कम समय का होना चाहिए।

## 3. OS गहराई में

- **Event loop:** JavaScript का एक thread। 50 ms से लंबा task input जमा देता है। PDF parsing एक **Web Worker** में जाती है (दूसरा thread, message passing)।
- **Scheduling के औज़ार:** `setTimeout` (debounce), `setInterval` (heartbeat, poll), `requestAnimationFrame` (हर frame में एक बार draw), `visibilitychange` (रोकना, flush)।
- **घड़ियाँ:** `performance.now()` monotonic है; `Date.now()` उछल सकता है। Background tabs timers धीमे करते हैं, इसलिए बीता समय मापा जाता है, ticks से कभी नहीं गिना जाता।
- **Memory:** garbage collection उसे मुक्त करता है जिसे कोई reference नहीं करता। हर effect cleanup लौटाता है (`clearInterval`, `removeEventListener`, `observer.disconnect()`), वरना listeners leak होते हैं।
- **Threads के बिना concurrency:** re-entrancy guards (`backendSync.push()` में `busy` और `again` flags), tabs के बीच lease lock, mutex के रूप में promise।
- **Storage hierarchy:** memory (सबसे तेज़), `localStorage` (synchronous, लगभग 5 MB), IndexedDB (asynchronous, बड़े blobs), server (टिकाऊ, सबसे धीमा)।

## 4. DBMS गहराई में

- **Schema:** हर feature के documents (JSON); key में `v2` schema version है।
- **Keys:** हर record के id में random हिस्सा है, इसलिए दो browsers कभी नहीं टकराते।
- **Code में constraints:** हर user की हर story पर एक reaction (upsert); खुद से share नहीं कर सकते; share और उसका notification एक ही कदम में बनते हैं।
- **Relations:** `playlistRelationships` many-to-many join table है; comments content और parent comment को refer करते हैं (एक tree)।
- **Transactions (छोटे स्तर पर):** state पहले memory में बदलती है, फिर एक snapshot write, इसलिए रखी copy कभी आधी अपडेट नहीं होती।
- **Replication:** client से server ops के ज़रिए; server से client sequence number से log read के ज़रिए; deletes tombstones के रूप में।
- **Consistency model:** devices के बीच eventual consistency; last write wins।
- **Derived data:** streaks सक्रिय दिनों के set से निकाली जाती हैं, कभी counter के रूप में नहीं रखी जातीं जो भटक सके।
- **Idempotency:** `opId` server पर रखा जाता है; duplicates नज़रअंदाज़।

## 5. OOP गहराई में

- **Encapsulation:** `UserNamespace` key format छिपाता है; `BackendTracking` अपनी queue और timer छिपाता है; repositories सिर्फ़ इरादा बताने वाले methods दिखाती हैं।
- **Abstraction:** repositories `KeyValueStore` पर निर्भर हैं, session layer `IdentityProvider` पर।
- **Inheritance:** `UserScopedRepository` फिर `ListRepository` फिर concrete repositories (जानबूझकर दो स्तर)।
- **Polymorphism:** `UserSession.clearAllData()` base type के ज़रिए हर repository पर `clear()` बुलाता है; tests browser store की जगह `MemoryKeyValueStore` लगाते हैं।
- **SOLID:** एक ही काम वाले calculators (`LifetimeStatsCalculator`), open/closed exporter registry और decorator, बदले जा सकने वाले stores, चार methods का interface, constructors से dependency injection।
- **जहाँ OOP नहीं है:** React components hooks वाले functions हैं; शुद्ध helpers (`grading.ts`, `wpmCalculator.ts`) सादे functions हैं क्योंकि उनमें state नहीं है।

## 6. आम सवालों के एक-पंक्ति जवाब

| सवाल | इस code से जवाब |
|---|---|
| Race condition कहाँ संभाली गई है? | एक साथ आए 401 एक refresh promise साझा करते हैं; एक doc edit करने वाले दो tabs lease lock इस्तेमाल करते हैं। |
| Caching कहाँ है? | Hash वाले नामों के static assets; editor और flip reader में LRU caches; IndexedDB text cache। |
| Queue कहाँ है? | `localStorage` में tracking outbox, batches में flush। |
| State machine कहाँ है? | Reading flow का reducer। |
| Binary search कहाँ है? | `pageIndexAt()` पढ़ने की line के नीचे का पन्ना ढूँढता है। |
| सही होने के लिए set कहाँ है? | कई-विकल्प grading जवाबों के sets की तुलना करती है; streaks सक्रिय दिनों के set पर चलती हैं। |
| Hash कहाँ है? | DOCX export के ZIP writer में CRC32; `lib/editor/util/hash.ts` में WebCrypto से SHA-256 content hashes (insecure origins पर cyrb53 fallback)। |
