# 06 · Backend, APIs & Databases

## Easy
1. **REST verbs/status codes?** GET/POST/PUT/PATCH/DELETE; 200/201/204, 400/401/403/404/409/422, 429, 500/503.
2. **PUT vs PATCH? Idempotency?** PUT replaces (idempotent); PATCH partial (may not be).
3. **Primary key vs foreign key vs unique?**
4. **SQL joins.** INNER, LEFT, RIGHT, FULL; know what each returns on missing matches.
5. **What is middleware in Express?** Functions in the request pipeline: parse, auth, validate, error handler last.

## Medium
1. **Index design.** B-tree on filter+sort columns; composite order = equality first, then range/sort; covering indexes; cost on writes. Read `EXPLAIN ANALYZE`.
2. **Transactions & isolation.** ACID; read committed vs repeatable read vs serializable; phantom reads; lost update → `SELECT … FOR UPDATE` or optimistic version column.
3. **N+1 queries.** Prisma `include`/`select`, `IN` batching, DataLoader.
4. **Validation & error handling.** Schema-validate at the edge (Zod), map domain errors to codes, never leak stack traces, central error middleware.
5. **Pagination & filtering API.** Cursor tokens, stable sort keys, max page size.
6. **File uploads.** Presigned URLs straight to object storage; validate type/size; scan; thumbnails async. *Here:* thumbnails are validated/sanitised by `safeThumbnail` on the client; the backend must re-validate.
7. **Migrations.** Expand → migrate → contract; never drop a column in the same release that stops using it.

## Hard
1. **Zero-downtime schema change on a 500M-row table.** Online DDL, shadow table + dual writes + backfill + cutover, feature flags.
2. **Distributed transaction without 2PC.** Saga (choreography vs orchestration), outbox pattern, idempotent consumers.
3. **Exactly-once?** Impossible end-to-end; at-least-once + idempotency keys + dedupe tables.
4. **Caching strategies & invalidation.** Cache-aside, write-through, stampede protection (single-flight, jittered TTL), versioned keys.
5. **Hot-row contention / counters.** Sharded counters, Redis `INCR` + periodic flush, CRDT counters.
6. **Query tuning case.** Slow `ORDER BY created_at LIMIT 20` with a filter: composite index `(user_id, created_at DESC)`, avoid `OFFSET`, check plan for sort node.
7. **Node performance.** Event loop blocking (CPU work → worker threads), streaming big responses, connection pooling (PgBouncer), graceful shutdown (SIGTERM drain).
