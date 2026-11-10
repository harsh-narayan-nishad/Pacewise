# 06 · Backend, APIs & Databases

## Easy
1. **REST verbs/status codes क्या हैं?** GET/POST/PUT/PATCH/DELETE; 200/201/204, 400/401/403/404/409/422, 429, 500/503।
2. **PUT बनाम PATCH? Idempotency?** PUT replace करता है (idempotent); PATCH partial होता है (शायद न हो)।
3. **Primary key बनाम foreign key बनाम unique?**
4. **SQL joins।** INNER, LEFT, RIGHT, FULL; जानो कि match न मिलने पर हर एक क्या लौटाता है।
5. **Express में middleware क्या है?** Request pipeline के functions: parse, auth, validate, और आख़िर में error handler।

## Medium
1. **Index design।** Filter+sort columns पर B-tree; composite order = पहले equality, फिर range/sort; covering indexes; writes पर cost। `EXPLAIN ANALYZE` पढ़ो।
2. **Transactions & isolation।** ACID; read committed बनाम repeatable read बनाम serializable; phantom reads; lost update → `SELECT … FOR UPDATE` या optimistic version column।
3. **N+1 queries।** Prisma `include`/`select`, `IN` batching, DataLoader।
4. **Validation & error handling।** Edge पर schema-validate करो (Zod), domain errors को codes से map करो, stack traces कभी leak मत करो, central error middleware।
5. **Pagination & filtering API।** Cursor tokens, stable sort keys, max page size।
6. **File uploads।** Presigned URLs से सीधे object storage में; type/size validate करो; scan करो; thumbnails async। *यहाँ:* thumbnails को client पर `safeThumbnail` validate/sanitise करता है; backend को दोबारा validate करना होगा।
7. **Migrations।** Expand → migrate → contract; जिस release में column का इस्तेमाल बंद करो उसी में उसे कभी drop मत करो।

## Hard
1. **500M-row table पर zero-downtime schema change।** Online DDL, shadow table + dual writes + backfill + cutover, feature flags।
2. **2PC के बिना distributed transaction।** Saga (choreography बनाम orchestration), outbox pattern, idempotent consumers।
3. **Exactly-once?** End-to-end असंभव; at-least-once + idempotency keys + dedupe tables।
4. **Caching strategies & invalidation।** Cache-aside, write-through, stampede protection (single-flight, jittered TTL), versioned keys।
5. **Hot-row contention / counters।** Sharded counters, Redis `INCR` + periodic flush, CRDT counters।
6. **Query tuning case।** Filter के साथ धीमा `ORDER BY created_at LIMIT 20`: composite index `(user_id, created_at DESC)`, `OFFSET` से बचो, plan में sort node जाँचो।
7. **Node performance।** Event loop blocking (CPU work → worker threads), बड़े responses की streaming, connection pooling (PgBouncer), graceful shutdown (SIGTERM drain)।
