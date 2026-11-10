# 05 · System Design

Framework (हर बार इस्तेमाल करो): **requirements → estimates → API → data model → high-level design → deep dives → bottlenecks/failure modes → trade-offs।**

## Easy (components और vocabulary)
1. **Load balancer क्या है?** Traffic बाँटता है (L4/L7), health-checks करता है, rolling deploys संभव बनाता है।
2. **Cache — कहाँ और क्यों?** Browser, CDN, app (Redis), DB buffer। Latency/load घटाता है; कीमत है staleness।
3. **SQL बनाम NoSQL?** Relations/transactions बनाम flexible schema/horizontal scale; access patterns के हिसाब से चुनो।
4. **CDN क्या है?** Static assets और videos के लिए edge cache (इस project का landing video)।
5. **Horizontal बनाम vertical scaling?**

## Medium
1. **एक URL shortener design करो।** Counter/ID service का Base62; read-heavy → cache; 301 बनाम 302; abuse limits।
2. **एक rate limiter design करो।** Redis में token bucket (atomic Lua), per-user/IP keys, headers `Retry-After`; distributed clock की सावधानियाँ।
3. **एक notification system design करो।** Producer → queue (Kafka/SQS) → हर channel के workers; idempotency keys; backoff के साथ retries + DLQ; user preferences।
4. **इस Speed Reader platform को design करो।** Stories (CRUD, tags, thumbnails), per-user sessions/history, quizzes, comments/likes। Postgres + Prisma, PDFs/images के लिए object storage (S3), CDN, hot lists के लिए Redis, search के लिए Postgres FTS → बाद में OpenSearch। Frontend: Next.js; हर user के लिए session isolation (user बदलने पर `SessionBoundary` remount होता है)।
5. **Pagination।** Offset बनाम keyset (cursor); keyset क्यों scale करता है और inserts के दौरान stable रहता है।
6. **Replies/likes वाला comment system design करो।** Adjacency list + `depth`, async reconciliation के साथ denormalised counters।

## Hard
1. **Google Docs / collaborative editor design करो।** OT बनाम CRDT; operation log, presence, cursors, offline merge, snapshots + compaction, permissions; document shard के हिसाब से WebSocket fan-out। (इस roadmap के "teams और shared notes" से संबंधित।)
2. **YouTube/Netflix streaming design करो।** Upload → transcode ladder (HLS/DASH) → object store पर segments → CDN; adaptive bitrate; recommendation एक अलग pipeline के रूप में।
3. **एक ride-dispatch system design करो** (तुम्हारा DispatchHub project)। Geo-index (H3/geohash), batching windows के साथ matching, supply/demand surge, idempotent consumers के साथ at-least-once events।
4. **एक global feed ranking design करो।** Candidate generation → ranking → re-ranking; fan-out on write बनाम read; hot-key (celebrity) handling।
5. **एक payments system design करो।** Idempotency keys, double-entry ledger, sagas, reconciliation, outbox के ज़रिए exactly-once *effects*।
6. **Multi-region active-active।** Conflict resolution, data residency, failover drills, consistency levels (PACELC)।

## Cross-cutting talking points
- **CAP/PACELC**, consistency models, idempotency, backpressure, circuit breakers, observability (RED/USE metrics, tracing), SLOs और error budgets, capacity maths (QPS = DAU × actions / 86 400, peak के लिए ×3–5)।
