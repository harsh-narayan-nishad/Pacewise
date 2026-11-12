# Scaling to 100M users

Pacewise today serves a handful of users from one free-tier server. This page takes each feature the JD's teams own (feeds, notifications, authentication, sharing, SEO, onboarding, trust and safety) and shows what the Pacewise version does now, what breaks at about 100 million daily users, and the design that replaces it. This is the "what would you change at scale" answer for Google, Apple or Reddit level loops.

## 1. Back-of-the-envelope numbers

| Quantity | Assumption | Result |
|---|---|---|
| Daily active users | 100 M (Reddit reports about 130 M daily uniques) | — |
| Feed loads | 10 per user per day | 1 B per day, about 12,000 per second on average, 3 to 5 times that at peak |
| Votes (likes) | 5 per user per day | 500 M per day, about 6,000 writes per second |
| Comments | 0.5 per user per day | 50 M per day |
| Notifications | 3 per user per day | 300 M per day; fan-out is the hard part |
| Polling at today's 15 s | 10 M concurrent users | about 670,000 requests per second doing nothing useful: the first thing to remove |

## 2. Feed (Home, Recommendations, Discovery)

**Now:** `rankStoriesByInterest()` in the browser counts topic overlap with the user's interests and stably sorts; `PersonalizedFeed` pages through the list 6 at a time.

**Breaks because:** every client would download every candidate; there are no engagement signals, freshness, or diversity; ranking logic ships to every browser.

**At scale:**
1. **Candidate generation** (thousands per user): subscribed communities, follows, embeddings nearest neighbours, trending.
2. **Ranking** with a model on features (topic match, author affinity, freshness decay, predicted engagement), served by a ranking service over gRPC.
3. **Re-ranking** for diversity, de-duplication and safety filters.
4. **Serving:** precompute for heavy users (fan-out on write) and compute on read for celebrities and cold users (hybrid); cache feed pages in Redis; **cursor pagination** so new posts do not shift pages.
5. **Experimentation:** every ranking change ships behind an A/B flag and is judged on engagement and retention, not offline accuracy alone.

## 3. Votes, comments and counters

**Now:** one reaction row per (story, user), counts computed by filtering rows; comments as a tree with `parentId`.

**At scale:**
- Store votes keyed by (post, user) for uniqueness; keep **counters** separately and update them asynchronously (sharded counters or a stream aggregator) because a hot post gets thousands of votes per second.
- Show approximate counts; reconcile in the background.
- Comments: store by post, ordered by score; load top-level comments first, children on demand (the tree is paginated per level).

## 4. Notifications

**Now:** notification rows created in the store, synced with 15 s polling; an SSE client hook is ready but not mounted.

**At scale:**
1. An event (like, reply, follow, share) goes onto a queue (Kafka-style log).
2. A **notification service** decides who to tell, applies preferences, de-duplicates and **batches** ("12 people liked your post"), and rate-limits.
3. Delivery channels: in-app over a persistent connection (SSE or WebSocket gateway), mobile push (APNs, FCM), e-mail digests (through an HTTPS e-mail API, not SMTP from app servers).
4. Unread count kept as a counter per user; the list is paginated by cursor.
5. Fallback: if the live connection drops, the client fetches since its last seen id (the same cursor idea as `/sync/snapshot?since=`).

## 5. Authentication and accounts

**Now:** password (bcrypt) and Google sign-in; 15-minute JWT access token; rotating refresh token with reuse detection; tokens in `localStorage` per user.

**At scale:**
- Refresh token in an **httpOnly, Secure, SameSite** cookie; access token in memory only.
- A dedicated identity service; JWT signing keys rotated and published as JWKS so other services verify locally.
- Risk-based login (new device, impossible travel) with step-up verification; rate limits per IP and per account against credential stuffing.
- Passkeys (WebAuthn) as the modern passwordless option.
- E-mail through a provider API over HTTPS with bounce handling; never block sign-up on e-mail delivery.

## 6. Sharing, SEO and onboarding

**Now:** share to a person creates a share and a notification; a QR code links to public notes; `robots.ts` only allows the landing page; `metadataBase` currently points at the backend host.

**At scale:**
- **Social sharing:** every post has a canonical URL with Open Graph and Twitter card tags rendered on the server, so link previews work in chat apps; share links carry a tracking parameter to measure growth loops.
- **SEO:** server-render public pages (Next.js already supports this), canonical URLs, sitemaps per community, structured data, fast LCP. `metadataBase` should be the frontend's own domain so absolute OG URLs are correct.
- **Onboarding:** pick interests on first sign-in (the `interests` field already drives the feed), show a non-empty feed immediately (cold start from popular content), measure activation (first story finished, first quiz taken) per cohort.

## 7. Trust and safety, youth experience

- Rate-limit writes per account; detect spam patterns (identical comments, burst follows).
- Content moderation pipeline: automatic classifiers first, human review queue second, user reports feed both.
- Age-appropriate defaults for teen accounts: private profile, restricted messaging, filtered feed.
- Account states already exist (`ACCOUNT_BANNED`, `ACCOUNT_REJECTED`, admin approval), which is the hook for enforcement.

## 8. Data layer

| Data | Store at scale | Why |
|---|---|---|
| Users, auth | Relational (PostgreSQL), sharded by user id | Strong consistency for identity |
| Posts, comments | Wide-column or sharded relational, partitioned by post id | High write volume, simple access by key |
| Votes | Key-value keyed by (post, user) plus counter service | Uniqueness and hot-key counters |
| Feeds | Redis lists per user, rebuilt on demand | Fast reads, disposable |
| Events, notifications | Log (Kafka) then per-user store | Ordered, replayable fan-out |
| Search | Inverted index (Elasticsearch / OpenSearch) | Full-text and ranking |
| Media | Object storage + CDN; presigned uploads (already used) | Large files never touch API servers |

## 9. What stays the same

The ideas already in Pacewise carry over directly: idempotency keys, cursors instead of offsets, outbox queues, batching, single-flight refresh, per-user isolation, sanitising untrusted HTML, graceful degradation when a dependency is down, and measuring before shipping.
