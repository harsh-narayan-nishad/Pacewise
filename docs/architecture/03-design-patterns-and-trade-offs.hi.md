# Design patterns और trade-offs

Frontend में इस्तेमाल हुआ हर design pattern: कहाँ है, क्यों चुना गया, उसकी क़ीमत क्या है, और विकल्प क्या होता। Senior स्तर पर pattern के नाम से ज़्यादा वह **trade-off** मायने रखता है जिसका आप बचाव कर सकें।

## 1. सूची

| Pattern | कहाँ | यहाँ क्यों | क़ीमत / trade-off | विकल्प |
|---|---|---|---|---|
| **Repository** | `lib/session/repositories/*` | हर तरह के saved data की एक class; बुलाने वाले `add`, `toggle`, `recordSession` इस्तेमाल करते हैं, कच्ची keys कभी नहीं | ज़्यादा files; हर read storage से JSON parse करती है | हर जगह सीधे `localStorage` calls (लिखना तेज़, पर per-user अलग करना असंभव) |
| **Template Method** | `UserScopedRepository` (read, parse, fallback, write) और hooks `feature()`, `emptyValue()`, `deserialize()` | न बदलने वाला algorithm एक बार लिखा; subclasses सिर्फ़ तीन छोटे कदम भरती हैं | Inheritance subclasses को base से बाँधता है; दो स्तर तक सीमित | Generic `JsonSlot<T>` helper के साथ composition |
| **Aggregate root + Facade** | `UserSession` | एक object एक user की हर चीज़ का मालिक; `clearAllData()` सिर्फ़ उसी user का data मिटाता है | एक बड़ा object; god class नहीं बनना चाहिए | अलग-अलग repositories इधर-उधर भेजना |
| **Facade / Adapter** | `lib/storage.ts` | नीचे की layer दोबारा बनाते समय पुराने `storage.*` calls चलते रहे | एक अतिरिक्त कदम; एक काम के दो नाम | हर call site एक साथ दोबारा लिखना |
| **Value Object** | `UserNamespace` (private constructor, `forUser()` factory) | Key format सिर्फ़ यहीं है; खाली id `guest` बनता है, कभी बिना namespace की key नहीं | हर call पर छोटा allocation | हर call site पर string जोड़ना (जिस bug को इसने हटाया) |
| **Strategy / Dependency Inversion** | `KeyValueStore` के साथ `BrowserKeyValueStore` और `MemoryKeyValueStore`; `IdentityProvider` | वही code browser, SSR और tests में चलता है | एक interface संभालना पड़ता है | Tests में `window.localStorage` mock करना |
| **Decorator** | `SyncingKeyValueStore` किसी भी store को लपेटता है | किसी repository को छुए बिना cloud copy जोड़ता है (open/closed) | हर write पर छिपा side effect; सस्ता रहना चाहिए | हर repository के अंदर API call |
| **Composition root** | `lib/session/composition.ts` | Concrete classes चुनने वाली अकेली file | इस्तेमाल से पहले import होनी चाहिए; एक cycle के लिए `backendTracking.ts` में lazy import चाहिए था | DI container (इस आकार के लिए बहुत भारी) |
| **Singleton (module instance)** | `devDataStore`, `backendSync`, `backendTracking`, `tokenStore`, `sessionManager`, `readingPresence` | हर पेज पर एक साझा instance, API client की तरह | Global state; tests को इसे reset करना पड़ता है | हर एक के लिए React context (ज़्यादा boilerplate, वही lifetime) |
| **Observer / pub-sub** | Stores पर `subscribe`/`getVersion`, `onLocalChange`, `toastBus`, presence listeners | कई components एक बदलाव पर बिना prop drilling प्रतिक्रिया देते हैं | Listeners leak होना आसान; हर subscription को cleanup चाहिए | State को poll करना, या state library |
| **External store + `useSyncExternalStore`** | `useDevStore`, `useUserSession`, `useToasts` | Concurrent React में बिना tearing के read; React के बाहर की classes के साथ काम करता है | Version counter किसी भी बदलाव पर हर subscriber को re-render करता है | Selectors वाला Zustand / Redux |
| **State machine (reducer)** | `contexts/ReadingContext.tsx` | Reading flow (dashboard, reading, completed, questions, results) के transitions साफ़ और जाँचने लायक | सारे actions एक switch में; features के साथ बढ़ता है | Pages में बिखरे `useState` |
| **Split context** | `ReadingContext.tsx` में `StateContext` और `DispatchContext` | सिर्फ़ dispatch करने वाले components state बदलने पर re-render नहीं होते | एक की जगह दो hooks | Memoised selectors वाला एक context |
| **Single-flight (promise sharing)** | `client.ts` में `refreshAccessToken()` | दस 401 एक ही refresh करवाते हैं, इसलिए refresh-token rotation नहीं टूटता | `finally` में reset होने वाला module-level variable | Mutex या request queue |
| **Idempotency key के साथ retry** | हर tracking event पर `opId` | सुरक्षित retries; at-least-once delivery पर exactly-once असर | Server को देखे गए ids रखने पड़ते हैं | Duplicates मान लेना और बाद में हटाना |
| **Outbox / persistent queue** | `backendTracking` में `srt:track:q:<userId>` | Tab बंद होने या offline होने पर पढ़ने का समय नहीं खोता | Queue बढ़ सकती है; 2,000 पर सीमा | तुरंत भेजना और विफलता पर data खोना |
| **Debounce और batch** | `backendSync` में 400 ms push देरी और 200-op batches; tracking में 3 s flush और 100-event batches; editor में 800 ms autosave | कम requests और writes | देरी जितनी latency जुड़ती है; tab छिपने पर flush ज़रूरी | हर बदलाव पर भेजना |
| **Baseline diff (change data capture)** | `BackendSync.diff()` | सिर्फ़ बदला हुआ भेजता है, deletions समेत | Baseline map के लिए memory; हर push पर पूरा scan | हर record पर per-field dirty flags |
| **Sequence cursor** | `GET /sync/snapshot?since=<seq>` | आख़िरी देखे offset के बाद के बदलाव ही खींचना, log की तरह | Server को change log और tombstones रखने पड़ते हैं | हर poll पर सब कुछ दोबारा download |
| **Lease lock** | `lib/editor/persistence/EditLock.ts` | दो tabs एक document एक साथ edit नहीं कर सकते; crash हुए tab की lease ख़त्म हो जाती है (deadlock नहीं) | सच्चा lock नहीं: race की एक खिड़की रहती है, जो दोबारा पढ़कर सुलझती है | `BroadcastChannel` या Web Locks API |
| **Memento / Command** | `SelectionMemento`, `HistoryStack`, editor `commands.ts` | Undo/redo और toolbar clicks के बाद selection वापस लाना | हर snapshot के लिए memory | Browser का built-in undo (custom ops के साथ टूटता है) |
| **Registry + Visitor** | `ExporterRegistry` (DOCX, Markdown, HTML, plain text); `PlainTextVisitor`, `MarkdownVisitor` document पर चलते हैं | नया export format बस एक registration है (open/closed) | Indirection | Format पर `switch` |
| **LRU cache** | `lib/editor/util/LruCache.ts`; flip-reader के page और text caches | Render हुए पन्नों और lookups के लिए सीमित memory | निकाली गई चीज़ों को दोबारा render करना पड़ता है | असीमित `Map` (बड़ी PDFs पर leak) |
| **Virtualisation / windowing** | Flip-book की render window | सिर्फ़ पास के पन्ने render होते हैं, इसलिए 500 पन्नों की PDF भी smooth रहती है | Scroll rendering से तेज़ हो तो खाली झलक | हर पन्ना render करना (memory ख़त्म) |
| **Error boundary** | `app/error.tsx`, `app/global-error.tsx` | किसी screen के crash पर सफ़ेद पेज की जगह recovery screen | Event handlers या async code के errors नहीं पकड़ता | हर जगह try/catch |
| **Graceful degradation** | Offline demo sign-in; calendar local copy पर लौटता है; storage विफल होने पर memory | कोई dependency बंद हो तब भी app चलता है | Test करने के लिए दो code paths | Error screen के साथ पूरी विफलता |

## 2. जानबूझकर इस्तेमाल न किए गए patterns

| इस्तेमाल नहीं | क्यों नहीं (अभी) | कब बदलें |
|---|---|---|
| Redux / Zustand | `useReducer` + external stores काफ़ी हैं और कोई dependency नहीं जोड़ते | जब कई screens को एक बड़े साझा graph पर selectors चाहिए |
| React Query / SWR | Server से कम reads; ज़्यादातर data पहले local है | जब screens caching और revalidation के साथ सीधे server data पढ़ें |
| GraphQL client | REST surface छोटा और resource जैसा है | जब कई clients को एक ही data के अलग आकार चाहिए (देखें [API design](05-api-design-rest-graphql-grpc.md)) |
| WebSocket | Data कम बार बदलता है; polling + वैकल्पिक SSE काफ़ी है | Real-time co-editing या chat |
| CRDT / OT | आज दो लोग एक ही record एक साथ edit नहीं करते | Collaborative documents (देखें [Google Docs design](../interview/12-system-design-google-docs.md)) |
| गहरी class hierarchies | Composition को प्राथमिकता; inheritance दो स्तर तक | कभी लक्ष्य के रूप में नहीं |

## 3. Interview में बचाव करने वाले बड़े trade-offs

### पहले local बनाम पहले server
- **चुना:** पहले local। UI कभी network का इंतज़ार नहीं करता, और free-tier backend सो रहा हो तब भी app चलता है।
- **क़ीमत:** सच के दो स्रोत, sync code, last-write-wins conflicts, और दूसरे user को बदलाव दिखने में 15 s तक।
- **बचाव:** पढ़ने की प्रैक्टिस ज़्यादातर एक user का data है; social data कुछ सेकंड की देरी सह लेता है।

### `localStorage` में tokens बनाम httpOnly cookies
- **चुना:** `localStorage`, हर user के लिए अलग, 15 मिनट के access tokens और घूमने वाले refresh tokens के साथ।
- **क़ीमत:** कोई भी XSS tokens पढ़ सकता है। बचाव: docs renderer पहले सब कुछ escape करता है और story HTML के लिए editor का `HtmlSanitizer` भरोसे की सीमा है। हर `dangerouslySetInnerHTML` (reader, reading mode, docs, question text, Mermaid) को सिर्फ़ sanitiser या renderer का output मिलना चाहिए; यही सूची audit checklist है।
- **बड़े पैमाने पर बेहतर:** refresh token httpOnly, `Secure`, `SameSite` cookie में; access token सिर्फ़ memory में; refresh endpoint पर CSRF सुरक्षा।

### Polling बनाम push
- **चुना:** sequence-cursor snapshot का 15 s polling (सरल, किसी भी proxy के पीछे चलता है, sleep के बाद भी ठीक)।
- **क़ीमत:** कुछ न बदलने पर भी व्यर्थ requests, और 15 s तक देरी।
- **अगला कदम:** notifications के लिए मौजूदा SSE hook mount करना; polling को fallback रखना।

### पूरा snapshot save करना
- **चुना:** social store हर बदलाव के बाद अपना पूरा snapshot save करता है।
- **क़ीमत:** `localStorage.setItem` synchronous है; बड़ा snapshot हर click पर main thread रोकता है।
- **सुधार:** save को debounce करना, या per-record writes के साथ IndexedDB।

### Client पर ranking
- **चुना:** browser में रुचि के मिलान से feed ranking।
- **क़ीमत:** हर client सारे candidates download करता है; कोई personalised learning नहीं; कोई global signals नहीं।
- **बड़े पैमाने पर:** server पर candidate generation और ranking (देखें [100M users तक scaling](07-scaling-to-100m-users.md))।

## 4. जिन anti-patterns से बचा गया

- Page tree में reading state की **prop drilling**: context से बदली गई।
- **Pixel पर आधारित progress** जो reflow पर उछलती थी: progress को सच का स्रोत बनाकर बदली गई।
- **Global, बिना namespace की keys** जो एक user का इतिहास अगले को दे देती थीं: `UserNamespace` से बदली गईं।
- एक साथ आए 401 पर **refresh stampede**: single-flight से बदला गया।
- **Echo loops** (server का data सीधे server को वापस भेजना): `touchQuiet()` से रोका गया।
- **Timer ticks से पढ़ने का समय गिनना**: `performance.now()` के अंतर से बदला गया, हर beat पर सीमित।
