# API design: REST, GraphQL and gRPC

How the frontend talks to the backend, why the API is REST, how errors, pagination, auth and retries are designed, and when GraphQL or gRPC would be the better choice. The JD asks for "designing, building, and maintaining robust APIs using REST, GraphQL, gRPC, HTTP or Thrift", so this page is written to be defended in that interview.

## 1. The REST surface the frontend uses

All paths are under `/api/v1` (the version lives in the URL). Every call goes through `apiFetch` in `lib/api/client.ts`; each endpoint has one typed wrapper in `lib/api/endpoints.ts`.

| Resource | Endpoints | Notes |
|---|---|---|
| Health | `GET /health` | Wakes a sleeping server; used by the sign-in status toast |
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/change-password`; `GET /auth/me`, `/auth/availability` | Login-type calls skip the Bearer header |
| E-mail flows | `POST /auth/verify-email`, `/auth/verify-email-otp`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/reset-password-otp` | Link token or 6-digit code |
| Users | `GET /users?updatedSince=`, `GET /users/:username`, `PATCH /users/me`, `POST` / `DELETE /users/:username/follow`, `GET /users/:id/followers`, `/following` | Incremental people list by `updatedSince` |
| Stories | `GET /stories?q=&tag=&page=&pageSize=`, `GET /stories/:id`, `POST /stories`, `PATCH` / `DELETE /stories/:id` | Paginated list |
| Social | `PUT` / `DELETE /stories/:id/reaction`, `GET` / `POST /stories/:id/comments`, `DELETE /comments/:id`, `POST /stories/:id/share`, `PUT /stories/:id/bookmark` | `PUT` for set-to-value actions (idempotent) |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /notifications/stream?token=` (SSE) | Stream ready on the client |
| Playlists | `GET` / `POST /playlists`, `GET` / `PATCH` / `DELETE /playlists/:id`, `POST /playlists/:id/items`, `DELETE /playlists/:id/items/:storyId`, `GET /playlists/public/:userId` | Public vs private enforced server-side |
| History | `POST /history`, `GET /history?page=`, `GET /history/stats`, `GET /history/highlights?today=`, `PATCH /history/:id/topics` | Topic edits allowed for a short window |
| Sync | `POST /sync/ops`, `GET /sync/snapshot?since=` | Batch write and log read (section 5) |
| Tracking | `POST /tracking/events`, `PUT /tracking/blobs/:feature`, `GET /tracking/state`, `GET /tracking/summary?today=` | Idempotent events by `opId` |
| Uploads | `POST /uploads/presign`, `GET /uploads/:key/url` | The file itself goes straight to object storage with a presigned `PUT` |
| Calendar | `GET` / `POST /calendar/events`, `PATCH` / `DELETE /calendar/events/:id` | Local fallback when offline |

## 2. Conventions

- **Nouns for resources, HTTP verbs for actions.** `PUT /stories/:id/reaction` sets the reaction (repeating it changes nothing: idempotent); `POST` creates.
- **JSON in, JSON out.** `Content-Type: application/json`; `204 No Content` returns no body and `apiFetch` returns `undefined`.
- **One error envelope.** Every failure is `{ "error": { "message", "code", "details" } }`. The client turns it into `ApiError(status, message, code, details)`; validation errors carry `details.fieldErrors` so the form shows the first field message.
- **Pagination.** List endpoints return `{ items, total, page, pageSize }`. Offset paging is simple; at scale switch to cursor paging (stable under inserts, no deep `OFFSET` scans).
- **Incremental reads.** `GET /users?updatedSince=` and `GET /sync/snapshot?since=` return only what changed: the client keeps the last cursor.
- **Versioning.** `/api/v1` in the path. Additive changes (new optional fields) stay in v1; breaking changes get v2 while v1 keeps serving old clients.

## 3. Auth design

| Piece | Choice | Why |
|---|---|---|
| Credential check | Server only (bcrypt) | The browser never stores or compares passwords |
| Access token | JWT, about 15 minutes, `Authorization: Bearer` | Stateless check on every request; short life limits damage if leaked |
| Refresh token | Long-lived, **rotated on every use**, reuse detection on the server | A stolen refresh token is detected the moment both copies are used |
| Refresh on the client | Single-flight in `apiFetch` | Prevents parallel refreshes from tripping reuse detection |
| Logout | `POST /auth/logout` revokes the refresh token; `logout-all` revokes every device | Server-side revocation, not just deleting local tokens |
| Google | ID token verified server-side | Never trust identity claims from the browser |
| Account state | `403 ACCOUNT_BANNED` / `ACCOUNT_REJECTED` | Admin actions take effect on the next request |

## 4. Reliability in the API contract

- **Idempotency keys** (`opId`) on tracking events, so retries are safe.
- **Batching**: up to 200 sync ops and 100 events per request reduce round trips; the body limit (2 MB) is respected by skipping blobs over 1.5 million characters.
- **Presigned uploads**: big files skip the API server entirely, so the API stays small and fast; the URL expires.
- **Health endpoint** for warm-up and monitoring.
- **Rate limits** return `429`; the client should back off (exponential backoff with jitter is the standard answer).

## 5. The sync protocol in detail

```text
Push:  POST /sync/ops
       { "ops": [ { "op": "put", "collection": "reactions", "id": "reaction-3-k2j9xq", "data": { ... } },
                  { "op": "delete", "collection": "comments", "id": "comment-7-a81kd0" } ] }
       Server: checks ownership of every op (the client checks first with mayPush), applies, bumps seq.

Pull:  GET /sync/snapshot?since=41
       { "seq": 57, "upserts": { "reactions": [ ... ] }, "deletes": { "comments": [ "comment-7-a81kd0" ] } }
       Client: merges without echoing back, stores seq = 57.
```

Properties: ownership enforced twice (client to save bandwidth, server for security), deletions are explicit tombstones, the cursor makes each pull proportional to the changes, and a lost response is harmless because the next pull starts from the last stored cursor.

## 6. REST vs GraphQL vs gRPC

| | REST (used) | GraphQL | gRPC |
|---|---|---|---|
| Shape of data | Fixed per endpoint | Client asks for exact fields | Fixed by `.proto` messages |
| Transport | HTTP/1.1 or 2, JSON | Usually one `POST /graphql`, JSON | HTTP/2, binary Protocol Buffers |
| Browser support | Native | Native (it is HTTP) | Needs gRPC-Web and a proxy |
| Caching | HTTP caches and CDNs work by URL | Harder: one URL; needs client caches (normalised by id) | No HTTP caching |
| Over/under-fetching | Can happen | Solved by design | Not a concern between services |
| Typing | Optional (OpenAPI) | Schema is mandatory | Strong, generated stubs |
| Streaming | SSE, chunked | Subscriptions (usually WebSocket) | Built-in bidirectional streams |
| Best for | Public, cacheable, resource-shaped APIs | Product UIs with many screens and nested data (feeds, profiles) | Service-to-service calls with low latency |

**Why REST here:** few clients, resource-shaped data, free HTTP caching, simplest to debug with the browser's network tab, and the sync endpoints already cut chatty traffic.

**When to move to GraphQL:** when a screen needs story + author + reaction counts + top comments + "did I like it" in one round trip, and web, iOS and Android each want different fields. That is exactly a Reddit-style feed. Add DataLoader-style batching on the server to avoid N+1 queries, and persisted queries so the CDN can cache them.

**When to use gRPC:** between backend services (feed ranking, notification fan-out, search) where latency and strict contracts matter, never directly from the browser.

**Thrift:** same niche as gRPC (binary RPC with an IDL); the trade-offs are the same.

## 7. Questions you can be asked

- Design the API for "like a post". Which verb, which status codes, how do you keep it idempotent?
- How would you paginate a feed that gets new posts every second? (Cursor, not offset.)
- How do you version an API used by old mobile apps you cannot update?
- Your API returns 401 to ten parallel requests. What happens in the client, and what can go wrong?
- When would you put GraphQL in front of existing REST services?
- How do you upload a 200 MB PDF without it passing through your API servers?
