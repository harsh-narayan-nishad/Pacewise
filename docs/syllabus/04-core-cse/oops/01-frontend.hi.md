# Frontend

**OOPs · Frontend।** Pacewise web app में React components (functions) के साथ उनके पीछे की logic के लिए TypeScript classes मिली-जुली हैं। यह page object-oriented हिस्से और उनके होने की वजह दिखाता है।

## App में Classes और interfaces
| Class / interface | काम |
|---|---|
| `KeyValueStore` (interface) | "get, set, remove, keys": storage के बारे में repositories बस इतना ही जानती हैं |
| `BrowserKeyValueStore`, `MemoryKeyValueStore` | दो आपस में बदले जा सकने वाले implementations (असली browser, tests) |
| `SyncingKeyValueStore` | किसी भी store को wrap करता है और saved data को backend को भी भेजता है |
| `UserNamespace` | किसी user के लिए storage keys बनाता और parse करता है |
| `UserSession` | Signed-in user की सभी repositories रखता है |
| History, streak, bookmarks ... repositories | हर एक एक तरह के data की owner है |
| `ScopedTokenStore` | हर demo user के tokens अलग रखता है |
| `DevDataStore` | Social data (likes, comments, follows ...) change notifications के साथ |
| `PresenceTracker` / `readingPresence` | Heartbeat से reading time गिनता है |
| `BackendSync`, `BackendTracking` | Server के साथ sync; events को queue और retry करना |

## चार pillars
- **Encapsulation**: `BackendTracking` अपनी queue और timers private रखता है; screens `trackTime(...)` call करती हैं और queue को बिगाड़ नहीं सकतीं। `UserNamespace` अकेली जगह है जो key format जानती है।
- **Abstraction**: repository `KeyValueStore` से save करने को कहती है; उसे नहीं पता कि वह `localStorage` है, memory है या server।
- **Inheritance / interface implementation**: stores `KeyValueStore` को implement करते हैं। Composition को प्राथमिकता दें (नीचे); inheritance को उथला रखा गया है।
- **Polymorphism**: tests `MemoryKeyValueStore` पास करते हैं, app syncing store पास करता है; repository का code वही रहता है।

## Design patterns
| Pattern | कहाँ |
|---|---|
| **Decorator** | `SyncingKeyValueStore` किसी भी repository को बदले बिना cloud saving जोड़ता है |
| **Facade** | `lib/storage.ts` पुराने function names रखता है और session classes को forward करता है |
| **Repository** | हर तरह के saved data के लिए एक class |
| **Observer** | `devDataStore.onLocalChange` और React का `useSyncExternalStore` subscription |
| **Singleton** | `devDataStore`, `backendSync`, `backendTracking`, `tokenStore` एक बार बनाए जाते हैं |
| **Composition root** | `lib/session/composition.ts` वह एकमात्र जगह है जो concrete classes चुनती है |
| **Single-flight (promise sharing)** | इंतज़ार कर रही सभी requests के लिए एक साझा token refresh |

## इस code में SOLID
- **S**: `syncPolicy.ts` सिर्फ़ ownership तय करता है; `dateKey.ts` सिर्फ़ दिनों को format करता है।
- **O**: नई synced collection list में सिर्फ़ एक नाम है, loop में नई branch नहीं।
- **L**: कोई भी `KeyValueStore` किसी दूसरे की जगह ले सकता है।
- **I**: interface में चार छोटे methods हैं।
- **D**: repositories interface पर निर्भर हैं, और composition root class उपलब्ध कराता है।

## Classes और React
React components hooks वाले functions हैं; वे classes को extend करने की जगह singletons और subscriptions के ज़रिए इस्तेमाल करते हैं। Composition को प्राथमिकता दें: screen के पास एक session *है*; वह किसी तरह का session *नहीं* है। Types `strict` TypeScript में हैं, इसलिए गलत call compile error बन जाती है (design by contract का एक रूप)।

## आपसे पूछे जा सकने वाले सवाल
- इस project में polymorphism दिखाइए।
- Repositories को edit करने की जगह decorator क्यों?
- यहाँ composition या inheritance, और क्यों?
- Tests में composition root से आपको क्या मिलता है?
