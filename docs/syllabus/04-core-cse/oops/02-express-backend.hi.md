# Express backend

**OOPs · Express backend।** Pacewise API (Express + TypeScript + MongoDB) OOPs concepts का इस्तेमाल कैसे करती है।

## Layers (separation of concerns)
```text
routes      -> which URL runs which handler, plus middleware
controller  -> reads the request, calls a service, writes the response
service     -> the real rules (who may do what, which documents change)
models      -> the shape of the data in MongoDB
```
Controller कभी database को नहीं छूता; service कभी `req` या `res` को नहीं छूती। हर layer को अलग से test और change किया जा सकता है।

## चार pillars, असली उदाहरणों के साथ
| Pillar | कहाँ |
|---|---|
| **Encapsulation** | `UserNamespace` अकेला code है जो storage key format जानता है; `ScopedTokenStore` छिपाता है कि किस user के tokens इस्तेमाल हो रहे हैं; `BackendTracking` अपनी queue और retry logic को `trackTime()` के पीछे छिपाता है। |
| **Abstraction** | `KeyValueStore` एक interface है: repositories बस "get, set, remove, keys" जानती हैं, यह नहीं कि वह browser storage है, memory है या server। |
| **Inheritance** | `AppError` base class है; `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError` उसे status code के साथ extend करते हैं, ताकि एक ही error handler इनमें से किसी को भी सही HTTP response में बदल सके। |
| **Polymorphism** | `BrowserKeyValueStore`, `MemoryKeyValueStore` और `SyncingKeyValueStore` हर उस जगह आपस में बदले जा सकते हैं जहाँ `KeyValueStore` अपेक्षित है। |

## इस्तेमाल हुए Design patterns
| Pattern | कहाँ | फ़ायदा |
|---|---|---|
| **Decorator** | `SyncingKeyValueStore` किसी store को wrap करता है और saved data को backend को भी भेजता है | History, streak और bookmark classes में कोई बदलाव किए बिना cloud storage मिल गया |
| **Strategy** | Rate limiting में configure होने पर Redis, वरना in-memory map इस्तेमाल होता है | वही middleware, अलग storage, start पर चुना जाता है |
| **Chain of responsibility** | Express middleware chain (security, CORS, parse, auth, rate limit, validate, handler) | हर step एक काम करता है और request को आगे बढ़ाता है या रोक देता है |
| **Singleton** | एक MongoDB connection, एक Redis client, एक `backendSync` object | साझा pool; हर request के लिए अलग connection नहीं |
| **Observer** | `devDataStore.onLocalChange` sync layer को बताता है कि कुछ बदला; event bus notifications को खुली streams तक पहुँचाता है | Store को पता नहीं कि कौन सुन रहा है |
| **Repository** | Session layer की history, streak, bookmarks classes | हर तरह के data का data access एक ही जगह |
| **Facade** | `lib/storage.ts` पुराना API रखता है और नई session classes को forward करता है | किसी screen को दोबारा लिखना नहीं पड़ा |
| **Composition root** | `lib/session/composition.ts` वह एक file है जो तय करती है कि कौन-सी concrete classes आपस में जुड़ेंगी | Storage बदलना एक file का edit है |

## संक्षेप में SOLID
- **S**ingle responsibility: `policy.ts` सिर्फ़ permissions तय करता है; `consistency.ts` सिर्फ़ streak का गणित करता है।
- **O**pen/closed: नई synced collection जोड़ने का मतलब एक नाम और एक rule जोड़ना है, sync loop बदलना नहीं।
- **L**iskov: कोई भी `KeyValueStore` दूसरे की जगह ले सकता है और callers को पता भी नहीं चलता।
- **I**nterface segregation: `KeyValueStore` में चार छोटे methods हैं, कोई बड़ा storage API नहीं।
- **D**ependency inversion: repositories interface पर निर्भर हैं; composition root concrete store उपलब्ध कराता है।

## Classes के साथ pure functions
`authorize`, `canRead` और `computeConsistency` values लेते हैं और values लौटाते हैं, अंदर कोई database या छिपी clock नहीं होती। इसीलिए वे `node:test` में milliseconds में चलते हैं, 16 passing tests के साथ। Object-oriented design और pure functions साथ काम करते हैं: classes wiring और state रखती हैं, pure functions rules रखते हैं।

## Honest limits
- कुछ service modules classes नहीं बल्कि plain functions हैं। TypeScript में functions का module अक्सर ज़्यादा साफ़ चुनाव होता है; classes वहाँ इस्तेमाल होती हैं जहाँ state हो या बदले जा सकने वाले हिस्से चाहिए हों।
- `BackendSync` एक बड़ी class है (push, pull, restore, polling)। अगर यह और बढ़े, तो इसे `Pusher`, `Puller` और `Scheduler` में बाँट दें।

## आपसे पूछे जा सकने वाले सवाल
- आपने जो project बनाया उसमें polymorphism दिखाइए।
- मौजूदा class को edit करने की जगह decorator क्यों?
- Dependency inversion क्या है और इससे यहाँ क्या मदद मिली?
- Composition या inheritance, और कब?
