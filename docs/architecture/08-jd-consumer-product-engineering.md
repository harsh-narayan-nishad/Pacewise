# JD prep: Consumer Product Engineering

Built from a real job description (Reddit, Consumer Engineering, Product Backend / full-stack, base about $164k to $230k) and aimed at the same bar as Google, Apple and other top-paying loops. Each line of the JD is mapped to proof in this project, then Easy / Medium / Hard questions with short model answers that use your own code.

## JD line to project evidence

| JD asks for | Where you can prove it in Pacewise |
|---|---|
| Feeds, recommendations, content discovery | `PersonalizedFeed` + `rankStoriesByInterest`; search with history and voice; scaling plan in [Scaling to 100M users](07-scaling-to-100m-users.md) |
| Authentication | Password + Google sign-in, rotating refresh tokens, single-flight refresh, per-user token storage, OTP verify and reset |
| Notifications | Notification rows on like / comment / share / follow, unread count, polling sync, SSE hook ready |
| Social sharing, SEO | Share-to-person with notification, QR public notes, `robots.ts`, Open Graph metadata |
| Onboarding | Interests drive the first feed; sign-up with verification and approval states |
| Account management, trust and safety | Ban / reject account states enforced on every request; ownership checks on sync; sanitiser for user HTML |
| Full lifecycle: design, build, test, deploy | Design docs in `docs/`, 121 unit tests, Docker image, Vercel + Render deployment |
| Performance analysis | rAF reading engine, virtualised flip book, Web Vitals plan in [Performance](06-performance-testing-and-reliability.md) |
| API design (REST, GraphQL, gRPC, HTTP) | REST surface, error envelope, cursors, idempotency; comparison in [API design](05-api-design-rest-graphql-grpc.md) |
| JavaScript, TypeScript, React, Next.js | Strict TypeScript, App Router, `useSyncExternalStore`, reducer state machine, server metadata |
| Product-minded engineer | Reading presence counts only real reading; the backend status toast; offline demo sign-in when the server sleeps |
| Mentorship, standards | Bilingual docs, Hindi parity checker, documented patterns and trade-offs |

## Easy

1. **What happens when a user clicks "like"?** The store upserts one reaction per (story, user), creates a notification for the author on a new like, re-renders subscribers, saves locally, and after a 400 ms debounce pushes a `put` op to `POST /sync/ops`. The author sees it on their next 15 s pull.
2. **Why PUT for setting a reaction and POST for a comment?** Setting a reaction to a value is idempotent (repeat = same state), creating a comment is not.
3. **What is a refresh token for?** To get a new short-lived access token without asking for the password; it is long-lived, so it is rotated and revocable.
4. **What does `useSyncExternalStore` solve?** Reading a store that lives outside React without tearing in concurrent rendering, with one `subscribe` and one `getSnapshot`.
5. **Offset vs cursor pagination?** Offset is simple but shifts when new items arrive and gets slow deep in a list; a cursor ("after id X") is stable and uses an index.
6. **Why debounce sync pushes?** Many quick clicks become one request; the cost is up to 400 ms delay, so it must flush when the tab hides.
7. **What is an idempotency key?** A unique id per operation that the server remembers, so a retried request has no second effect (`opId` here).
8. **Server-side vs client-side rendering for a public post page?** Server-side, so crawlers and link previews see the content and LCP is faster.

## Medium

1. **Ten requests get 401 at once. Walk through the client.** All ten call `refreshAccessToken()`; the first creates `refreshInFlight`, the rest await it; tokens are saved once; each request retries once with `_isRetry`. Without this, parallel refreshes rotate the same token and the server's reuse detection revokes the session.
2. **How do you keep two users on one browser from seeing each other's data?** Keys are only built by `UserNamespace`; tokens are stored per user; `SessionBoundary` remounts the tree on a switch; tests in `session-isolation.test.ts` prove it.
3. **Design the notification badge so it is correct after a reconnect.** Keep the last seen cursor; on reconnect fetch "since cursor"; the unread count is derived from rows (or a server counter), never incremented blindly on the client.
4. **Polling, SSE or WebSocket for notifications?** SSE: server-to-client only, plain HTTP, auto-reconnect, works through proxies. WebSocket only if the client also streams (chat, co-editing). Keep polling as the fallback.
5. **How do you make reading-time tracking lose nothing and count nothing twice?** Outbox in `localStorage`, batches with unique `opId`s, server de-duplication, flush on tab hide, clamp per heartbeat.
6. **How would you A/B test a new feed ranking?** Assign users to buckets by a stable hash of user id, log exposure when the feed renders, compare engagement and retention per bucket with a pre-registered metric and sample size, ship only on a significant win without guardrail regressions (latency, reports).
7. **A page feels slow when users like many posts quickly. How do you find out why?** DevTools Performance: long tasks on each click; the cause is the synchronous `localStorage.setItem` of the whole snapshot. Fix: debounce or per-record IndexedDB writes; verify with INP before and after.
8. **How do you upload a large PDF?** Ask the API for a presigned URL, `PUT` the file straight to object storage, then save only the key; the API servers never carry the bytes.

## Hard

1. **Design Reddit's home feed.** Requirements (personalised, fresh, fast, safe), numbers (about 12k feed reads per second average), candidate generation, ranking service, re-ranking for diversity and safety, hybrid fan-out, Redis feed cache, cursor pagination, experimentation, and how the client renders it (infinite scroll, prefetch of the next page, skeletons). Tie back to `PersonalizedFeed` and say what changes.
2. **Design vote counting for a post going viral.** Unique vote per (post, user), asynchronous sharded counters, approximate display, idempotent vote changes (up to down is one update), anti-abuse rate limits, eventual reconciliation.
3. **Design notification fan-out for a user with 10 million followers.** Do not fan out on write to all; push only to active users, batch and collapse, let others pull on open, prioritise by relevance, respect quiet hours, and back-pressure the queue.
4. **Your offline-first sync uses last-write-wins. Where does it lose data and how would you fix it?** Two devices editing the same record offline: the later write erases the other. Fixes: per-field merge with version vectors, or CRDTs for collaborative text; for append-only data (comments, votes) conflicts mostly disappear.
5. **Secure the token storage.** Move the refresh token to an httpOnly cookie with `SameSite` and CSRF protection on refresh, keep the access token in memory, add a Content-Security-Policy, keep the sanitiser as the only HTML entry point, and use a short-lived single-purpose token for SSE.
6. **Migrate this API from REST to GraphQL without breaking mobile clients.** Put GraphQL as a gateway in front of existing REST services, add DataLoader batching to avoid N+1, use persisted queries for caching, keep REST v1 alive for old clients, measure p95 latency per resolver.

## How to tell the story (behavioural)

- **Ownership:** you found that the free-tier host blocks SMTP and documented the HTTPS e-mail API fix; you added a health check so users know when the backend is asleep.
- **Product sense:** reading time counts only when the tab is visible, the user is active and on a reading surface; vanity numbers were rejected.
- **Quality:** pure logic with injected clocks and stores, 121 tests, a Hindi parity checker for the docs.
- **Trade-offs you accepted and would revisit:** local-first with last-write-wins, polling, tokens in `localStorage`, client-side ranking.
