# Design patterns and trade-offs

Every design pattern used in the frontend, where it lives, why it was chosen, what it costs, and what the alternative would have been. At senior level the pattern name matters less than the **trade-off** you can defend.

## 1. Catalogue

| Pattern | Where | Why here | Cost / trade-off | Alternative |
|---|---|---|---|---|
| **Repository** | `lib/session/repositories/*` | One class per kind of saved data; callers use `add`, `toggle`, `recordSession`, never raw keys | More files; every read parses JSON from storage | Direct `localStorage` calls everywhere (fast to write, impossible to isolate per user) |
| **Template Method** | `UserScopedRepository` (read, parse, fallback, write) with hooks `feature()`, `emptyValue()`, `deserialize()` | The invariant algorithm is written once; subclasses fill three small steps | Inheritance couples subclasses to the base; kept to two levels | Composition with a generic `JsonSlot<T>` helper |
| **Aggregate root + Facade** | `UserSession` | One object owns everything for one user; `clearAllData()` wipes only that user | One big object; must not grow into a god class | Loose repositories passed around separately |
| **Facade / Adapter** | `lib/storage.ts` | Old `storage.*` calls kept working while the layer underneath was rebuilt | An extra hop; two names for one action | Rewriting every call site at once |
| **Value Object** | `UserNamespace` (private constructor, `forUser()` factory) | The only place the key format exists; blank id becomes `guest`, never an un-namespaced key | Small allocation per call | String concatenation at each call site (the bug source it replaced) |
| **Strategy / Dependency Inversion** | `KeyValueStore` with `BrowserKeyValueStore` and `MemoryKeyValueStore`; `IdentityProvider` | Same code runs in the browser, during SSR and in tests | An interface to maintain | Mocking `window.localStorage` in tests |
| **Decorator** | `SyncingKeyValueStore` wraps any store | Adds cloud mirroring without touching a single repository (open/closed) | Hidden side effect on every write; must stay cheap | Calling the API inside each repository |
| **Composition root** | `lib/session/composition.ts` | The one file that picks concrete classes | Must be imported before use; a cycle needed a lazy import in `backendTracking.ts` | A DI container (too heavy for this size) |
| **Singleton (module instance)** | `devDataStore`, `backendSync`, `backendTracking`, `tokenStore`, `sessionManager`, `readingPresence` | One shared instance per page, like an API client | Global state; tests must reset it | React context for each (more boilerplate, same lifetime) |
| **Observer / pub-sub** | `subscribe`/`getVersion` on the stores, `onLocalChange`, `toastBus`, presence listeners | Many components react to one change without prop drilling | Easy to leak listeners; every subscription needs a cleanup | Polling state, or a state library |
| **External store + `useSyncExternalStore`** | `useDevStore`, `useUserSession`, `useToasts` | Tear-free reads in concurrent React; works with classes outside React | A version counter re-renders every subscriber on any change | Zustand / Redux with selectors |
| **State machine (reducer)** | `contexts/ReadingContext.tsx` | The reading flow (dashboard, reading, completed, questions, results) has explicit, auditable transitions | All actions in one switch; grows with features | Scattered `useState` in pages |
| **Split context** | `StateContext` and `DispatchContext` in `ReadingContext.tsx` | Components that only dispatch do not re-render on state changes | Two hooks instead of one | One context with memoised selectors |
| **Single-flight (promise sharing)** | `refreshAccessToken()` in `client.ts` | Ten 401s cause one refresh, so refresh-token rotation is not broken | A module-level variable to reset in `finally` | A mutex or a request queue |
| **Retry with idempotency key** | `opId` on every tracking event | Safe retries; exactly-once effect on top of at-least-once delivery | Server must store seen ids | Accept duplicates and de-duplicate later |
| **Outbox / persistent queue** | `srt:track:q:<userId>` in `backendTracking` | Closing the tab or going offline loses no reading time | Queue can grow; capped at 2,000 | Send immediately and lose data on failure |
| **Debounce and batch** | 400 ms push delay and 200-op batches in `backendSync`; 3 s flush and 100-event batches in tracking; 800 ms autosave in the editor | Fewer requests and writes | Adds latency equal to the delay; must flush on tab hide | Send on every change |
| **Baseline diff (change data capture)** | `BackendSync.diff()` | Sends only what changed, including deletions | Memory for the baseline map; full scan per push | Per-field dirty flags on every record |
| **Sequence cursor** | `GET /sync/snapshot?since=<seq>` | Pull only changes after the last seen offset, like a log | The server must keep a change log and tombstones | Re-download everything each poll |
| **Lease lock** | `lib/editor/persistence/EditLock.ts` | Two tabs cannot both edit one document; a crashed tab's lease expires (no deadlock) | Not a true lock: a race window remains, resolved by re-read | `BroadcastChannel` or Web Locks API |
| **Memento / Command** | `SelectionMemento`, `HistoryStack`, editor `commands.ts` | Undo/redo and restoring the selection after toolbar clicks | Memory per snapshot | Relying on the browser's built-in undo (breaks with custom ops) |
| **Registry + Visitor** | `ExporterRegistry` (DOCX, Markdown, HTML, plain text); `PlainTextVisitor`, `MarkdownVisitor` walk the document | A new export format is one registration (open/closed) | Indirection | A `switch` on format |
| **LRU cache** | `lib/editor/util/LruCache.ts`; flip-reader page and text caches | Bounded memory for rendered pages and lookups | Evicted items cost a re-render | Unbounded `Map` (leaks on big PDFs) |
| **Virtualisation / windowing** | Flip-book render window | Only nearby pages are rendered, so 500-page PDFs stay smooth | Blank flashes if scrolling outruns rendering | Render every page (runs out of memory) |
| **Error boundary** | `app/error.tsx`, `app/global-error.tsx` | A crash in one screen shows a recovery screen instead of a white page | Does not catch errors in event handlers or async code | Try/catch everywhere |
| **Graceful degradation** | Offline demo sign-in; calendar falls back to local copy; storage failures fall back to memory | The app keeps working when a dependency is down | Two code paths to test | Hard failure with an error screen |

## 2. Patterns deliberately not used

| Not used | Why not (yet) | When to switch |
|---|---|---|
| Redux / Zustand | `useReducer` + external stores are enough and add no dependency | When many screens need selectors over one large shared graph |
| React Query / SWR | Few server reads; most data is local-first | When screens read server data directly with caching and revalidation |
| GraphQL client | The REST surface is small and resource-shaped | When many clients need different shapes of the same data (see [API design](05-api-design-rest-graphql-grpc.md)) |
| WebSocket | Data changes are low-frequency; polling + optional SSE fits | Real-time co-editing or chat |
| CRDT / OT | No two people edit the same record at the same time today | Collaborative documents (see [Google Docs design](../interview/12-system-design-google-docs.md)) |
| Deep class hierarchies | Composition is preferred; inheritance stays two levels deep | Never as a goal |

## 3. The big trade-offs to defend in an interview

### Local-first vs server-first
- **Chosen:** local-first. The UI never waits for the network, and the app works while the free-tier backend is asleep.
- **Cost:** two sources of truth, sync code, last-write-wins conflicts, and up to 15 s before another user sees a change.
- **Defence:** reading practice is mostly single-user data; social data tolerates seconds of delay.

### Tokens in `localStorage` vs httpOnly cookies
- **Chosen:** `localStorage`, scoped per user, with 15-minute access tokens and rotating refresh tokens.
- **Cost:** any XSS can read tokens. Mitigations: the docs renderer escapes everything first and the editor's `HtmlSanitizer` is the trust boundary for story HTML. Every `dangerouslySetInnerHTML` (reader, reading mode, docs, question text, Mermaid) must only ever receive sanitiser or renderer output; that list is the audit checklist.
- **Better at scale:** refresh token in an httpOnly, `Secure`, `SameSite` cookie; access token only in memory; CSRF protection on the refresh endpoint.

### Polling vs push
- **Chosen:** 15 s polling of a sequence-cursor snapshot (simple, works behind any proxy, survives sleeps).
- **Cost:** wasted requests when nothing changed, and up to 15 s delay.
- **Next step:** mount the existing SSE hook for notifications; keep polling as the fallback.

### Whole-snapshot persistence
- **Chosen:** the social store saves its whole snapshot after each change.
- **Cost:** `localStorage.setItem` is synchronous; a large snapshot blocks the main thread on every click.
- **Fix:** debounce the save, or move to IndexedDB with per-record writes.

### Client-side ranking
- **Chosen:** feed ranking by interest overlap in the browser.
- **Cost:** every client downloads all candidates; no personalised learning; no global signals.
- **At scale:** server-side candidate generation and ranking (see [Scaling to 100M users](07-scaling-to-100m-users.md)).

## 4. Anti-patterns avoided

- **Prop drilling** of reading state through the page tree: replaced by context.
- **Pixel-based progress** that jumped on reflow: replaced by progress as the source of truth.
- **Global, un-namespaced keys** that leaked one user's history to the next: replaced by `UserNamespace`.
- **Refresh stampede** on parallel 401s: replaced by single-flight.
- **Echo loops** (server data pushed straight back to the server): prevented by `touchQuiet()`.
- **Counting reading time with timer ticks**: replaced by `performance.now()` differences, clamped per beat.
