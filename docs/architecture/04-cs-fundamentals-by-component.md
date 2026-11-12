# CS fundamentals by component

The four core subjects (Computer Networks, Operating Systems, DBMS, OOP) mapped to **each component** of the frontend. The subject-wise pages already exist under Core CSE; this page is the other axis: pick a component, see every concept it uses.

Subject-wise pages: [CN](../syllabus/04-core-cse/cn/01-frontend.md) · [OS](../syllabus/04-core-cse/os/01-frontend.md) · [DBMS](../syllabus/04-core-cse/dbms/01-frontend.md) · [OOPs](../syllabus/04-core-cse/oops/01-frontend.md).

## 1. The matrix

| Component | CN | OS | DBMS | OOP |
|---|---|---|---|---|
| `lib/api/client.ts` | HTTPS, JSON, Bearer auth, status codes, CORS pre-flight | Promise as a mutex (single-flight) | — | `ApiError` subclass of `Error` |
| `lib/api/AuthContext.tsx` | Token refresh, health ping to wake a sleeping server | Effect cleanup flag to avoid races | Session validity check (`/auth/me`) | Context as a provider of one interface |
| `ScopedTokenStore` | — | Per-user isolation (like per-process credentials) | Key namespacing | Encapsulation, injected dependencies |
| `backendSync` | Debounce, batching, polling, visibility-driven pulls | Timers, background throttling, re-entrancy guard (`busy`/`again`) | Change data capture, baseline diff, tombstones, sequence cursor, last-write-wins | Singleton class with private state |
| `backendTracking` | Batches of 100, retry on failure | Persistent queue survives tab close | Idempotency key (`opId`), exactly-once effect | Encapsulated queue |
| `SyncingKeyValueStore` | Triggers uploads | — | Reconcile on first link (upload vs restore) | Decorator |
| `lib/session/*` | — | Namespaces as per-user directories | Tables as repositories, schema version `v2`, one-time migration | Template Method, Repository, Value Object, Facade |
| `devDataStore` | — | Synchronous `localStorage` write blocks the main thread | Unique (contentId, userId), join table for playlists, cascade on delete, one snapshot write per action | Observer, Singleton |
| `ReadingContext` | — | — | — | State machine via reducer |
| `useReadingEngine` | — | `requestAnimationFrame` scheduling, frame time `dt`, `ResizeObserver` | — | Strategy (pure WPM functions) |
| `readingPresence` / `PresenceTracker` | — | Heartbeat, idle timeout, clamp for suspended timers, `performance.now()` monotonic clock | Per-user running total | Model with injected storage and clock |
| `EditLock` | — | Lease lock with timeout, no deadlock, race resolved by re-read | Lost-update prevention | Encapsulated lock |
| `AutosaveScheduler` | — | Write-back cache / write coalescing, flush on hide | Durability point | Generic class `AutosaveScheduler<T>` |
| `HtmlSanitizer` | Trust boundary for content from the network | — | — | Policy object (`SanitizePolicy`) |
| `lib/flipreader/*` | Lazy loading of the pdf.js worker | Worker thread, memory budget, virtualisation (demand paging), cancellation | IndexedDB text cache with invalidation | Immutable page list, overlays as data |
| `mediaStory` | — | File picker sandbox; worker thread for parsing | — | Adapter: media becomes a `StoryData` |
| `landingMedia`, `thumbnailVideo` | — | Blob storage outside the main heap | IndexedDB object store, transactions | Small module API |
| `lib/qr.ts` | Error correction (Reed-Solomon) like in network coding | — | — | Pure functions |
| `NotificationBell` | Data arrives through polling; SSE hook ready | — | Unread count derived from rows | Observer through the store |
| `PersonalizedFeed` | Paginated loading (`IntersectionObserver`) | — | Ranking by matching attributes | Reusable component with props |
| Docs site (`lib/docs`) | Build-time bundling, on-demand search index | — | Inverted-style section index | Renderer with options |
| `next.config.js` | Security and cache headers | — | — | — |

## 2. CN in depth: a request from Pacewise

1. **DNS** resolves the backend host; **TCP** handshake; **TLS** handshake (certificate check, key exchange).
2. Cross-origin call: the browser sends an `OPTIONS` **pre-flight** because of the `Authorization` and `Content-Type: application/json` headers. The server answers with `Access-Control-Allow-Origin` for the frontend's origin.
3. The real request: `Authorization: Bearer <access token>`, JSON body.
4. Status codes the client handles: `200/201`, `204` (no body), `401` (refresh + retry), `403` (banned: sign out), `4xx` (show the message), `5xx` / network error (keep data queued, retry).
5. **Keep-alive** reuses the connection for later requests; **HTTP/2** multiplexes many requests over one connection.
6. Real-time options: polling (used), SSE (ready), WebSocket (not needed). SSE uses one long HTTP response; `EventSource` cannot set headers, so the token goes in the URL and must be short-lived.

## 3. OS in depth

- **Event loop:** one JavaScript thread. A task longer than 50 ms freezes input. PDF parsing goes to a **Web Worker** (another thread, message passing).
- **Scheduling primitives:** `setTimeout` (debounce), `setInterval` (heartbeat, poll), `requestAnimationFrame` (draw once per frame), `visibilitychange` (pause, flush).
- **Clocks:** `performance.now()` is monotonic; `Date.now()` can jump. Background tabs throttle timers, so elapsed time is measured, never counted by ticks.
- **Memory:** garbage collection frees what nothing references. Every effect returns a cleanup (`clearInterval`, `removeEventListener`, `observer.disconnect()`), or listeners leak.
- **Concurrency without threads:** re-entrancy guards (`busy` and `again` flags in `backendSync.push()`), a lease lock across tabs, a promise as a mutex.
- **Storage hierarchy:** memory (fastest), `localStorage` (synchronous, about 5 MB), IndexedDB (asynchronous, large blobs), server (durable, slowest).

## 4. DBMS in depth

- **Schema:** documents (JSON) per feature; `v2` in the key is the schema version.
- **Keys:** every record has an id with a random part, so two browsers never collide.
- **Constraints in code:** one reaction per user per story (upsert); cannot share with yourself; a share and its notification are created in one step.
- **Relations:** `playlistRelationships` is a many-to-many join table; comments reference content and parent comment (a tree).
- **Transactions (small scale):** state changes in memory first, then one snapshot write, so the stored copy is never half-updated.
- **Replication:** client to server through ops; server to client through a log read from a sequence number; deletes as tombstones.
- **Consistency model:** eventual consistency between devices; last write wins.
- **Derived data:** streaks are computed from the set of active days, never stored as a counter that can drift.
- **Idempotency:** `opId` stored server-side; duplicates ignored.

## 5. OOP in depth

- **Encapsulation:** `UserNamespace` hides the key format; `BackendTracking` hides its queue and timer; repositories expose intention-revealing methods only.
- **Abstraction:** repositories depend on `KeyValueStore`, the session layer depends on `IdentityProvider`.
- **Inheritance:** `UserScopedRepository` then `ListRepository` then concrete repositories (two levels, on purpose).
- **Polymorphism:** `UserSession.clearAllData()` calls `clear()` on every repository through the base type; tests swap `MemoryKeyValueStore` for the browser store.
- **SOLID:** single-purpose calculators (`LifetimeStatsCalculator`), open/closed exporter registry and decorator, substitutable stores, a four-method interface, dependency injection through constructors.
- **Where OOP is not used:** React components are functions with hooks; pure helpers (`grading.ts`, `wpmCalculator.ts`) are plain functions because they have no state.

## 6. One-line answers to common questions

| Question | Answer from this code |
|---|---|
| Where is a race condition handled? | Parallel 401s share one refresh promise; two tabs editing one doc use a lease lock. |
| Where is caching used? | Static assets with hashed names; LRU caches in the editor and flip reader; IndexedDB text cache. |
| Where is a queue used? | The tracking outbox in `localStorage`, flushed in batches. |
| Where is a state machine used? | The reading flow reducer. |
| Where is binary search used? | `pageIndexAt()` finds the page under the reading line. |
| Where is a set used for correctness? | Multi-select grading compares answer sets; streaks walk a set of active days. |
| Where is a hash used? | CRC32 in the ZIP writer for DOCX export; SHA-256 content hashes through WebCrypto (cyrb53 fallback on insecure origins) in `lib/editor/util/hash.ts`. |
