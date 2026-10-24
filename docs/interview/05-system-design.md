# 05 · System Design

Framework (use every time): **requirements → estimates → API → data model → high-level design → deep dives → bottlenecks/failure modes → trade-offs.**

## Easy (components and vocabulary)
1. **Load balancer?** Spreads traffic (L4/L7), health-checks, enables rolling deploys.
2. **Cache — where and why?** Browser, CDN, app (Redis), DB buffer. Cuts latency/load; costs staleness.
3. **SQL vs NoSQL?** Relations/transactions vs flexible schema/horizontal scale; choose by access patterns.
4. **What is a CDN?** Edge cache for static assets and videos (this project's landing video).
5. **Horizontal vs vertical scaling?**

## Medium
1. **Design a URL shortener.** Base62 of a counter/ID service; read-heavy → cache; 301 vs 302; abuse limits.
2. **Design a rate limiter.** Token bucket in Redis (atomic Lua), per-user/IP keys, headers `Retry-After`; distributed clock caveats.
3. **Design a notification system.** Producer → queue (Kafka/SQS) → workers per channel; idempotency keys; retries with backoff + DLQ; user preferences.
4. **Design this Speed Reader platform.** Stories (CRUD, tags, thumbnails), per-user sessions/history, quizzes, comments/likes. Postgres + Prisma, object storage (S3) for PDFs/images, CDN, Redis for hot lists, search via Postgres FTS → OpenSearch later. Frontend: Next.js; session isolation per user (`SessionBoundary` remounts on user change).
5. **Pagination.** Offset vs keyset (cursor); why keyset scales and stays stable under inserts.
6. **Design a comment system with replies/likes.** Adjacency list + `depth`, denormalised counters with async reconciliation.

## Hard
1. **Design Google Docs / collaborative editor.** OT vs CRDT; operation log, presence, cursors, offline merge, snapshots + compaction, permissions; WebSocket fan-out by document shard. (Relevant to "teams and shared notes" on this roadmap.)
2. **Design YouTube/Netflix streaming.** Upload → transcode ladder (HLS/DASH) → segments on object store → CDN; adaptive bitrate; recommendation as a separate pipeline.
3. **Design a ride-dispatch system** (your DispatchHub project). Geo-index (H3/geohash), matching with batching windows, supply/demand surge, at-least-once events with idempotent consumers.
4. **Design a global feed ranking.** Candidate generation → ranking → re-ranking; fan-out on write vs read; hot-key (celebrity) handling.
5. **Design a payments system.** Idempotency keys, double-entry ledger, sagas, reconciliation, exactly-once *effects* via outbox.
6. **Multi-region active-active.** Conflict resolution, data residency, failover drills, consistency levels (PACELC).

## Cross-cutting talking points
- **CAP/PACELC**, consistency models, idempotency, backpressure, circuit breakers, observability (RED/USE metrics, tracing), SLOs and error budgets, capacity maths (QPS = DAU × actions / 86 400, ×3–5 for peak).
