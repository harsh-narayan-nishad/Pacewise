# World engineering references

The papers, specifications and engineering write-ups from Google, Amazon, Meta, Netflix, LinkedIn, Discord, Figma, Stripe and others that explain the ideas Pacewise uses at small scale. Each entry says what it teaches and which part of Pacewise it connects to, so you can cite real systems in an interview instead of generic answers. Titles are given exactly so they are easy to search; links are given only for standards and official documentation.

## 1. Distributed data and replication

| Reference | Source, year | What it teaches | In Pacewise |
|---|---|---|---|
| Dynamo: Amazon's Highly Available Key-value Store | Amazon, SOSP 2007 | Availability over consistency, vector clocks, sloppy quorum, hinted hand-off | Local-first writes that always succeed; last-write-wins as the simple version of conflict handling |
| Bigtable: A Distributed Storage System for Structured Data | Google, OSDI 2006 | Wide-column model, row keys designed for access patterns | Key design `srt:v2:u:<userId>:<feature>` |
| Spanner: Google's Globally-Distributed Database | Google, OSDI 2012 | External consistency with TrueTime, distributed transactions | Contrast to Pacewise's eventual consistency |
| Conflict-free Replicated Data Types | Shapiro, Preguiça, Baquero, Zawirski, 2011 | Data types that merge without conflicts | The fix for last-write-wins when two devices edit offline |
| Local-first software: You own your data, in spite of the cloud | Ink & Switch, Onward! 2019 | Seven ideals of local-first apps | The whole local-first, server-mirrored design |
| Time, Clocks, and the Ordering of Events in a Distributed System | Leslie Lamport, CACM 1978 | Logical clocks and happened-before | Sequence numbers in `/sync/snapshot?since=` |
| Designing Data-Intensive Applications | Martin Kleppmann, O'Reilly 2017 | Replication, partitioning, transactions, stream processing | Baseline diff, tombstones, idempotency, derived data |
| Sharding & IDs at Instagram | Instagram Engineering, 2012 | Time-ordered, shard-aware ids | Ids with a random part so browsers never collide |
| Announcing Snowflake | Twitter Engineering, 2010 | 64-bit time-ordered unique ids at scale | Same problem as Pacewise record ids, solved for billions |

## 2. Logs, messaging and real-time

| Reference | Source, year | What it teaches | In Pacewise |
|---|---|---|---|
| The Log: What every software engineer should know about real-time data's unifying abstraction | Jay Kreps (LinkedIn), 2013 | The append-only log as the backbone of data systems | The sync cursor reads a change log from an offset |
| Kafka: a Distributed Messaging System for Log Processing | LinkedIn, NetDB 2011 | Partitioned logs, consumer offsets | Notification fan-out design in the scaling page |
| How Discord Stores Billions of Messages | Discord Engineering, 2017 | Choosing a store for write-heavy, time-ordered data | Comments and notifications at scale |
| How Figma's multiplayer technology works | Figma Engineering, 2019 | Server-authoritative real-time editing, simpler than OT | What to build if Pacewise documents become collaborative |
| Server-sent events (HTML Living Standard) | WHATWG, [specification](https://html.spec.whatwg.org/multipage/server-sent-events.html) | `EventSource`, reconnection, named events | `useNotificationStream` |
| The WebSocket Protocol | IETF, [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455) | Full-duplex connections over one TCP socket | Why WebSocket is not needed yet |

## 3. Feeds, ranking and recommendations

| Reference | Source, year | What it teaches | In Pacewise |
|---|---|---|---|
| Deep Neural Networks for YouTube Recommendations | Google, RecSys 2016 | Two stages: candidate generation, then ranking | The feed plan in the scaling page |
| Wide & Deep Learning for Recommender Systems | Google, DLRS 2016 | Memorisation plus generalisation in one model | Next step after `rankStoriesByInterest` |
| TAO: Facebook's Distributed Data Store for the Social Graph | Meta, USENIX ATC 2013 | Objects and associations, read-heavy caching | Follows, likes, shares as associations |
| Scaling Memcache at Facebook | Meta, NSDI 2013 | Look-aside caching, leases against thundering herds | Feed and counter caches at scale |
| Reddit Engineering blog (r/RedditEng) | Reddit | How the JD's teams build feeds, notifications and safety | Background for the JD prep page |

## 4. Identity, auth and authorization

| Reference | Source, year | What it teaches | In Pacewise |
|---|---|---|---|
| The OAuth 2.0 Authorization Framework | IETF, [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) | Grants, access and refresh tokens | Access + refresh token pair |
| JSON Web Token (JWT) | IETF, [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) | Signed, self-contained claims | The 15-minute access token |
| Proof Key for Code Exchange (PKCE) | IETF, [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636) | Protecting public clients in OAuth flows | What a redirect-based Google flow would need |
| OAuth 2.0 Security Best Current Practice | IETF OAuth working group | Refresh-token rotation and reuse detection | Exactly what the backend does; why the client uses single-flight refresh |
| Zanzibar: Google's Consistent, Global Authorization System | Google, USENIX ATC 2019 | Relationship-based access control at scale | Ownership rules in `syncPolicy.ts`, public/private playlists |
| Apple Platform Security guide | Apple | Keychain, secure enclave, passkeys | Passkeys as the passwordless next step |
| OWASP Top 10 | OWASP, [project page](https://owasp.org/www-project-top-ten/) | The most common web risks | Security checklist on the performance page |
| Cross Site Scripting Prevention Cheat Sheet | OWASP, [cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) | Escaping and sanitising untrusted HTML | `HtmlSanitizer`, the docs renderer |

## 5. Web platform and performance

| Reference | Source, year | What it teaches | In Pacewise |
|---|---|---|---|
| Web Vitals | Google, [web.dev](https://web.dev/articles/vitals) | LCP, INP, CLS and their thresholds | Performance page |
| HTTP Semantics | IETF, [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | Methods, idempotency, status codes | `PUT` for reactions, `204`, `401` handling |
| Page Visibility API | MDN, [reference](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | Detecting hidden tabs | Auto-pause, flush on hide, presence |
| IndexedDB API | MDN, [reference](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) | Asynchronous, transactional browser storage | Landing media, thumbnails, flip-reader text cache |
| useSyncExternalStore | React, [reference](https://react.dev/reference/react/useSyncExternalStore) | Subscribing to stores outside React safely | Every store hook |

## 6. Reliability and operations

| Reference | Source, year | What it teaches | In Pacewise |
|---|---|---|---|
| Site Reliability Engineering | Google, O'Reilly 2016 | SLOs, error budgets, toil, incident response | What to add once Pacewise has real traffic |
| The Tail at Scale | Dean and Barroso (Google), CACM 2013 | Why p99 latency dominates at fan-out | Feed and notification services |
| Dapper, a Large-Scale Distributed Systems Tracing Infrastructure | Google, 2010 | Request tracing across services | Observability plan |
| Designing robust and predictable APIs with idempotency | Stripe Engineering, 2017 | Idempotency keys and safe retries | `opId` on tracking events |
| Fault Tolerance in a High Volume, Distributed System | Netflix Tech Blog, 2012 | Circuit breakers, fallbacks, bulkheads | Graceful degradation when the backend sleeps |
| MapReduce: Simplified Data Processing on Large Clusters | Google, OSDI 2004 | Batch computation over huge datasets | Offline analytics over reading history |

## 7. Engineering blogs to follow

| Blog | Strong on |
|---|---|
| Google Research and Google Cloud blogs | Large-scale systems, ML ranking |
| Meta Engineering | Social graph, caching, mobile performance |
| Netflix Tech Blog | Resilience, streaming, experimentation |
| Uber Engineering | Real-time dispatch, data platforms |
| Discord Engineering | Real-time messaging, storage migrations |
| Figma Engineering | Multiplayer editing, rendering in the browser |
| Stripe Engineering | API design, reliability |
| Reddit Engineering (r/RedditEng) | Feeds, notifications, safety at Reddit scale |
| Apple Machine Learning Research | On-device ML, privacy |

## 8. Reading order for interview preparation

1. Kleppmann (chapters on replication, partitioning, stream processing): the vocabulary for every system design round.
2. The Log (Kreps), then Kafka: the backbone of notifications and feeds.
3. YouTube recommendations, then TAO and Memcache: feeds and social graphs.
4. OAuth 2.0 Security BCP and OWASP XSS cheat sheet: auth and security rounds.
5. Stripe idempotency and The Tail at Scale: the reliability follow-up questions.
6. Dynamo, CRDTs and Local-first software: defending Pacewise's local-first design.
