# दुनिया के engineering references

Google, Amazon, Meta, Netflix, LinkedIn, Discord, Figma, Stripe और दूसरों के वे papers, specifications और engineering लेख जो उन विचारों को समझाते हैं जिन्हें Pacewise छोटे पैमाने पर इस्तेमाल करता है। हर entry बताती है कि वह क्या सिखाती है और Pacewise के किस हिस्से से जुड़ती है, ताकि interview में आप सामान्य जवाबों की जगह असली systems का हवाला दे सकें। Titles ठीक वैसे ही दिए गए हैं ताकि उन्हें खोजना आसान हो; links सिर्फ़ standards और आधिकारिक documentation के लिए दिए गए हैं।

## 1. Distributed data और replication

| Reference | स्रोत, साल | क्या सिखाता है | Pacewise में |
|---|---|---|---|
| Dynamo: Amazon's Highly Available Key-value Store | Amazon, SOSP 2007 | Consistency से ऊपर availability, vector clocks, sloppy quorum, hinted hand-off | Local-first writes जो हमेशा सफल होती हैं; conflict संभालने का सरल रूप last-write-wins |
| Bigtable: A Distributed Storage System for Structured Data | Google, OSDI 2006 | Wide-column model, पहुँच के तरीके के हिसाब से बनी row keys | Key design `srt:v2:u:<userId>:<feature>` |
| Spanner: Google's Globally-Distributed Database | Google, OSDI 2012 | TrueTime के साथ external consistency, distributed transactions | Pacewise की eventual consistency से तुलना |
| Conflict-free Replicated Data Types | Shapiro, Preguiça, Baquero, Zawirski, 2011 | ऐसे data types जो बिना conflict के मिल जाते हैं | जब दो devices offline edit करें तब last-write-wins का सुधार |
| Local-first software: You own your data, in spite of the cloud | Ink & Switch, Onward! 2019 | Local-first apps के सात आदर्श | पूरा local-first, server पर copy वाला design |
| Time, Clocks, and the Ordering of Events in a Distributed System | Leslie Lamport, CACM 1978 | Logical clocks और happened-before | `/sync/snapshot?since=` में sequence numbers |
| Designing Data-Intensive Applications | Martin Kleppmann, O'Reilly 2017 | Replication, partitioning, transactions, stream processing | Baseline diff, tombstones, idempotency, derived data |
| Sharding & IDs at Instagram | Instagram Engineering, 2012 | समय के क्रम वाले, shard जानने वाले ids | Random हिस्से वाले ids ताकि browsers कभी न टकराएँ |
| Announcing Snowflake | Twitter Engineering, 2010 | बड़े पैमाने पर 64-bit समय-क्रम वाले unique ids | Pacewise के record ids वाली ही समस्या, अरबों के लिए हल |

## 2. Logs, messaging और real-time

| Reference | स्रोत, साल | क्या सिखाता है | Pacewise में |
|---|---|---|---|
| The Log: What every software engineer should know about real-time data's unifying abstraction | Jay Kreps (LinkedIn), 2013 | Data systems की रीढ़ के रूप में append-only log | Sync cursor एक offset से change log पढ़ता है |
| Kafka: a Distributed Messaging System for Log Processing | LinkedIn, NetDB 2011 | Partitioned logs, consumer offsets | Scaling पेज में notification fan-out design |
| How Discord Stores Billions of Messages | Discord Engineering, 2017 | ज़्यादा writes वाले, समय-क्रम data के लिए store चुनना | बड़े पैमाने पर comments और notifications |
| How Figma's multiplayer technology works | Figma Engineering, 2019 | Server को अधिकार देने वाली real-time editing, OT से सरल | अगर Pacewise documents collaborative बनें तो क्या बनाना है |
| Server-sent events (HTML Living Standard) | WHATWG, [specification](https://html.spec.whatwg.org/multipage/server-sent-events.html) | `EventSource`, दोबारा जुड़ना, नाम वाले events | `useNotificationStream` |
| The WebSocket Protocol | IETF, [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455) | एक TCP socket पर दोतरफ़ा connections | अभी WebSocket की ज़रूरत क्यों नहीं |

## 3. Feeds, ranking और recommendations

| Reference | स्रोत, साल | क्या सिखाता है | Pacewise में |
|---|---|---|---|
| Deep Neural Networks for YouTube Recommendations | Google, RecSys 2016 | दो चरण: candidate generation, फिर ranking | Scaling पेज में feed की योजना |
| Wide & Deep Learning for Recommender Systems | Google, DLRS 2016 | एक model में याद रखना और सामान्यीकरण | `rankStoriesByInterest` के बाद का कदम |
| TAO: Facebook's Distributed Data Store for the Social Graph | Meta, USENIX ATC 2013 | Objects और associations, ज़्यादा reads वाली caching | Associations के रूप में follows, likes, shares |
| Scaling Memcache at Facebook | Meta, NSDI 2013 | Look-aside caching, thundering herd के ख़िलाफ़ leases | बड़े पैमाने पर feed और counter caches |
| Reddit Engineering blog (r/RedditEng) | Reddit | JD की teams feeds, notifications और safety कैसे बनाती हैं | JD तैयारी पेज की पृष्ठभूमि |

## 4. पहचान, auth और authorization

| Reference | स्रोत, साल | क्या सिखाता है | Pacewise में |
|---|---|---|---|
| The OAuth 2.0 Authorization Framework | IETF, [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) | Grants, access और refresh tokens | Access + refresh token की जोड़ी |
| JSON Web Token (JWT) | IETF, [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) | Signed, अपने में पूरे claims | 15 मिनट का access token |
| Proof Key for Code Exchange (PKCE) | IETF, [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636) | OAuth flows में public clients की सुरक्षा | Redirect वाले Google flow को क्या चाहिए होगा |
| OAuth 2.0 Security Best Current Practice | IETF OAuth working group | Refresh-token rotation और reuse detection | Backend ठीक यही करता है; client single-flight refresh क्यों करता है |
| Zanzibar: Google's Consistent, Global Authorization System | Google, USENIX ATC 2019 | बड़े पैमाने पर रिश्तों पर आधारित access control | `syncPolicy.ts` में मालिकाना नियम, public/private playlists |
| Apple Platform Security guide | Apple | Keychain, secure enclave, passkeys | बिना-password अगले कदम के रूप में passkeys |
| OWASP Top 10 | OWASP, [project page](https://owasp.org/www-project-top-ten/) | Web के सबसे आम जोखिम | Performance पेज पर security checklist |
| Cross Site Scripting Prevention Cheat Sheet | OWASP, [cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) | अविश्वसनीय HTML को escape और साफ़ करना | `HtmlSanitizer`, docs renderer |

## 5. Web platform और performance

| Reference | स्रोत, साल | क्या सिखाता है | Pacewise में |
|---|---|---|---|
| Web Vitals | Google, [web.dev](https://web.dev/articles/vitals) | LCP, INP, CLS और उनकी सीमाएँ | Performance पेज |
| HTTP Semantics | IETF, [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | Methods, idempotency, status codes | Reactions के लिए `PUT`, `204`, `401` संभालना |
| Page Visibility API | MDN, [reference](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | छिपे tabs पहचानना | अपने आप रुकना, छिपने पर flush, presence |
| IndexedDB API | MDN, [reference](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) | Asynchronous, transaction वाली browser storage | Landing media, thumbnails, flip-reader text cache |
| useSyncExternalStore | React, [reference](https://react.dev/reference/react/useSyncExternalStore) | React के बाहर के stores को सुरक्षित subscribe करना | हर store hook |

## 6. Reliability और operations

| Reference | स्रोत, साल | क्या सिखाता है | Pacewise में |
|---|---|---|---|
| Site Reliability Engineering | Google, O'Reilly 2016 | SLOs, error budgets, toil, incident response | असली traffic आने पर Pacewise में क्या जोड़ना है |
| The Tail at Scale | Dean और Barroso (Google), CACM 2013 | Fan-out पर p99 latency क्यों हावी होती है | Feed और notification services |
| Dapper, a Large-Scale Distributed Systems Tracing Infrastructure | Google, 2010 | Services के पार request tracing | Observability योजना |
| Designing robust and predictable APIs with idempotency | Stripe Engineering, 2017 | Idempotency keys और सुरक्षित retries | Tracking events पर `opId` |
| Fault Tolerance in a High Volume, Distributed System | Netflix Tech Blog, 2012 | Circuit breakers, fallbacks, bulkheads | Backend सोने पर graceful degradation |
| MapReduce: Simplified Data Processing on Large Clusters | Google, OSDI 2004 | बहुत बड़े datasets पर batch गणना | पढ़ने के इतिहास पर offline analytics |

## 7. पढ़ने लायक engineering blogs

| Blog | किसमें मज़बूत |
|---|---|
| Google Research और Google Cloud blogs | बड़े पैमाने के systems, ML ranking |
| Meta Engineering | Social graph, caching, mobile performance |
| Netflix Tech Blog | Resilience, streaming, experimentation |
| Uber Engineering | Real-time dispatch, data platforms |
| Discord Engineering | Real-time messaging, storage migrations |
| Figma Engineering | Multiplayer editing, browser में rendering |
| Stripe Engineering | API design, reliability |
| Reddit Engineering (r/RedditEng) | Reddit के पैमाने पर feeds, notifications, safety |
| Apple Machine Learning Research | Device पर ML, privacy |

## 8. Interview तैयारी के लिए पढ़ने का क्रम

1. Kleppmann (replication, partitioning, stream processing वाले अध्याय): हर system design round की शब्दावली।
2. The Log (Kreps), फिर Kafka: notifications और feeds की रीढ़।
3. YouTube recommendations, फिर TAO और Memcache: feeds और social graphs।
4. OAuth 2.0 Security BCP और OWASP XSS cheat sheet: auth और security rounds।
5. Stripe idempotency और The Tail at Scale: reliability वाले follow-up सवाल।
6. Dynamo, CRDTs और Local-first software: Pacewise के local-first design का बचाव।
