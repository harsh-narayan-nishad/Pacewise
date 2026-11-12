# JD तैयारी: Consumer Product Engineering

एक असली job description (Reddit, Consumer Engineering, Product Backend / full-stack, base लगभग $164k से $230k) से बना, और Google, Apple व दूसरी सबसे ज़्यादा pay करने वाली companies के उसी स्तर के लिए। JD की हर line इस project के सबूत से जोड़ी गई है, फिर Easy / Medium / Hard सवाल छोटे model जवाबों के साथ, जो आपका अपना code इस्तेमाल करते हैं।

## JD की line से project का सबूत

| JD क्या माँगता है | Pacewise में आप इसे कहाँ साबित कर सकते हैं |
|---|---|
| Feeds, recommendations, content discovery | `PersonalizedFeed` + `rankStoriesByInterest`; history और आवाज़ वाला search; scaling योजना [100M users तक scaling](07-scaling-to-100m-users.md) में |
| Authentication | Password + Google sign-in, घूमने वाले refresh tokens, single-flight refresh, हर user के लिए अलग token storage, OTP verify और reset |
| Notifications | Like / comment / share / follow पर notification rows, unread count, polling sync, SSE hook तैयार |
| Social sharing, SEO | Notification के साथ व्यक्ति को share, QR public notes, `robots.ts`, Open Graph metadata |
| Onboarding | रुचियाँ पहला feed चलाती हैं; verification और approval स्थितियों के साथ sign-up |
| Account management, trust और safety | Ban / reject account स्थितियाँ हर request पर लागू; sync पर मालिकाना हक़ की जाँच; user HTML के लिए sanitiser |
| पूरा lifecycle: design, build, test, deploy | `docs/` में design docs, 121 unit tests, Docker image, Vercel + Render deployment |
| Performance analysis | rAF reading engine, virtualised flip book, [Performance](06-performance-testing-and-reliability.md) में Web Vitals योजना |
| API design (REST, GraphQL, gRPC, HTTP) | REST surface, error envelope, cursors, idempotency; तुलना [API design](05-api-design-rest-graphql-grpc.md) में |
| JavaScript, TypeScript, React, Next.js | Strict TypeScript, App Router, `useSyncExternalStore`, reducer state machine, server metadata |
| Product सोच वाला engineer | Reading presence सिर्फ़ असली पढ़ाई गिनता है; backend status toast; server सोए तो offline demo sign-in |
| Mentorship, मानक | दो भाषाओं वाले docs, हिंदी parity checker, लिखे हुए patterns और trade-offs |

## Easy

1. **User "like" दबाए तो क्या होता है?** Store हर (story, user) के लिए एक reaction upsert करता है, नए like पर लेखक के लिए notification बनाता है, subscribers को दोबारा render करता है, local save करता है, और 400 ms के debounce के बाद `POST /sync/ops` पर `put` op push करता है। लेखक अपने अगले 15 s pull पर इसे देखता है।
2. **Reaction set करने के लिए PUT और comment के लिए POST क्यों?** Reaction को किसी मान पर set करना idempotent है (दोहराना = वही स्थिति), comment बनाना नहीं।
3. **Refresh token किसलिए है?** Password माँगे बिना नया कम समय वाला access token पाने के लिए; यह लंबे समय का है, इसलिए rotate होता है और रद्द किया जा सकता है।
4. **`useSyncExternalStore` क्या हल करता है?** React के बाहर रहने वाले store को concurrent rendering में बिना tearing पढ़ना, एक `subscribe` और एक `getSnapshot` से।
5. **Offset बनाम cursor pagination?** Offset सरल है पर नए items आने पर खिसकता है और सूची में गहराई पर धीमा होता है; cursor ("id X के बाद") स्थिर है और index इस्तेमाल करता है।
6. **Sync pushes को debounce क्यों?** कई जल्दी clicks एक request बनते हैं; क़ीमत 400 ms तक की देरी है, इसलिए tab छिपने पर flush ज़रूरी है।
7. **Idempotency key क्या है?** हर operation का unique id जिसे server याद रखता है, ताकि दोबारा भेजे request का दूसरा असर न हो (यहाँ `opId`)।
8. **Public post पेज के लिए server-side बनाम client-side rendering?** Server-side, ताकि crawlers और link previews content देखें और LCP तेज़ हो।

## Medium

1. **दस requests को एक साथ 401 मिलता है। Client में क्या होता है?** दसों `refreshAccessToken()` बुलाते हैं; पहला `refreshInFlight` बनाता है, बाकी उसका इंतज़ार करते हैं; tokens एक बार save होते हैं; हर request `_isRetry` के साथ एक बार दोबारा जाता है। इसके बिना एक साथ refreshes उसी token को rotate करते हैं और server की reuse detection session रद्द कर देती है।
2. **एक browser पर दो users को एक-दूसरे का data देखने से कैसे रोकते हैं?** Keys सिर्फ़ `UserNamespace` बनाता है; tokens हर user के लिए अलग रखे जाते हैं; `SessionBoundary` बदलने पर tree दोबारा mount करता है; `session-isolation.test.ts` के tests इसे साबित करते हैं।
3. **Notification badge ऐसा design करें कि reconnect के बाद सही रहे।** आख़िरी देखा cursor रखें; reconnect पर "cursor के बाद" fetch करें; unread count rows से निकाला जाए (या server counter), client पर आँख मूँदकर कभी न बढ़ाया जाए।
4. **Notifications के लिए polling, SSE या WebSocket?** SSE: सिर्फ़ server से client, सादा HTTP, अपने आप reconnect, proxies के पार चलता है। WebSocket तभी जब client भी stream करे (chat, co-editing)। Polling को fallback रखें।
5. **पढ़ने के समय की tracking को ऐसा कैसे बनाएँ कि कुछ न खोए और कुछ दो बार न गिने?** `localStorage` में outbox, unique `opId` वाले batches, server पर de-duplication, tab छिपने पर flush, हर heartbeat पर clamp।
6. **नई feed ranking का A/B test कैसे करेंगे?** User id के स्थिर hash से users को buckets में बाँटें, feed render होने पर exposure log करें, पहले से तय metric और sample size के साथ हर bucket का engagement और retention तुलना करें, guardrails (latency, reports) बिगाड़े बिना साफ़ जीत पर ही ship करें।
7. **Users जल्दी-जल्दी कई posts like करें तो पेज धीमा लगता है। कारण कैसे ढूँढेंगे?** DevTools Performance: हर click पर लंबे tasks; कारण पूरे snapshot का synchronous `localStorage.setItem` है। सुधार: debounce या per-record IndexedDB writes; पहले और बाद में INP से जाँचें।
8. **बड़ी PDF कैसे upload करेंगे?** API से presigned URL माँगें, file सीधे object storage में `PUT` करें, फिर सिर्फ़ key save करें; API servers कभी bytes नहीं ढोते।

## Hard

1. **Reddit का home feed design करें।** Requirements (personalised, ताज़ा, तेज़, सुरक्षित), संख्याएँ (औसतन लगभग 12k feed reads प्रति सेकंड), candidate generation, ranking service, विविधता और safety के लिए re-ranking, hybrid fan-out, Redis feed cache, cursor pagination, experimentation, और client उसे कैसे दिखाता है (infinite scroll, अगले पन्ने का prefetch, skeletons)। `PersonalizedFeed` से जोड़ें और बताएँ क्या बदलता है।
2. **Viral हो रही post के लिए vote गिनती design करें।** हर (post, user) का एक vote, asynchronous sharded counters, अनुमानित display, idempotent vote बदलाव (up से down एक update है), दुरुपयोग रोकने के rate limits, बाद में मिलान।
3. **1 करोड़ followers वाले user के लिए notification fan-out design करें।** सब पर fan out on write न करें; सिर्फ़ सक्रिय users को push करें, batch और collapse करें, बाकी खोलने पर pull करें, प्रासंगिकता से प्राथमिकता दें, quiet hours का सम्मान करें, और queue पर back-pressure रखें।
4. **आपका offline-first sync last-write-wins इस्तेमाल करता है। यह कहाँ data खोता है और कैसे ठीक करेंगे?** दो devices offline एक ही record edit करें: बाद वाली write दूसरी को मिटा देती है। सुधार: version vectors के साथ per-field merge, या collaborative text के लिए CRDTs; append-only data (comments, votes) में conflicts ज़्यादातर ग़ायब हो जाते हैं।
5. **Token storage सुरक्षित करें।** Refresh token को `SameSite` वाली httpOnly cookie में ले जाएँ और refresh पर CSRF सुरक्षा दें, access token memory में रखें, Content-Security-Policy जोड़ें, sanitiser को HTML का अकेला प्रवेश द्वार रखें, और SSE के लिए कम समय का एक ही काम वाला token इस्तेमाल करें।
6. **Mobile clients तोड़े बिना इस API को REST से GraphQL पर ले जाएँ।** मौजूदा REST services के आगे GraphQL को gateway की तरह लगाएँ, N+1 से बचने के लिए DataLoader batching जोड़ें, caching के लिए persisted queries इस्तेमाल करें, पुराने clients के लिए REST v1 चालू रखें, हर resolver का p95 latency मापें।

## कहानी कैसे सुनाएँ (behavioural)

- **Ownership:** आपने पाया कि free-tier host SMTP रोकता है और HTTPS e-mail API वाला सुधार लिखा; आपने health check जोड़ा ताकि users जानें कि backend कब सो रहा है।
- **Product की समझ:** पढ़ने का समय तभी गिनता है जब tab दिख रहा हो, user सक्रिय हो और पढ़ने वाली surface पर हो; दिखावटी संख्याएँ ठुकरा दी गईं।
- **Quality:** बाहर से दी गई घड़ियों और stores वाला शुद्ध logic, 121 tests, docs के लिए हिंदी parity checker।
- **आपने जो trade-offs स्वीकार किए और दोबारा देखेंगे:** last-write-wins के साथ पहले local, polling, `localStorage` में tokens, client पर ranking।
