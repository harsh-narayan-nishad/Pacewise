# Express backend

**Computer networks · Express backend.** How the Pacewise API (Express + TypeScript + MongoDB) uses networking: which call uses which protocol, and the networking ideas behind it.

## Where it sits

```text
Browser (Next.js app)
   |  HTTPS  (HTTP/1.1 or HTTP/2 over TLS over TCP)  — JSON requests
   v
Load balancer / nginx  (optional, only with several API instances)
   |  HTTP
   v
Express API  (Node.js, one event loop per process)
   |-- MongoDB wire protocol over TCP (TLS on Atlas)     -> data
   |-- RESP over TCP                                     -> Redis (optional: shared rate limit + live events)
   '-- HTTPS (AWS SDK)                                   -> S3 (optional: only signs URLs; the browser uploads directly)
```

## Which call uses which protocol

| Call | Protocol and style | Why this one |
|---|---|---|
| Browser to API (everything below) | HTTPS, request/response, JSON body | Works through every proxy and CDN, easy to cache and debug. |
| Sign up, log in, refresh, log out | `POST /auth/*` | A body carries the password; never a URL. Rate limited to 20 per minute. |
| Read data (stories, comments, profile, snapshot) | `GET` | Safe to repeat, no side effects. |
| Change my data (likes, comments, saves, playlists, follows) | `POST /sync/ops` with a list of `put` / `delete` operations | One request carries many changes, so a burst of clicks is one round trip. |
| Receive other people's changes | `GET /sync/snapshot?since=N` every 15 s | Polling is simple and survives sleeping laptops and flaky mobile data. |
| Reading time, tests, streak events | `POST /tracking/events` (each event has a unique id) | The id makes a retry safe: the same event is never counted twice. |
| Reading history, bookmarks, achievements ... | `PUT /tracking/blobs/:key` | PUT means "replace this value", which is exactly what saving a list is. |
| Live notifications | `GET /notifications/stream`, a long-lived HTTP response (Server-Sent Events, `text/event-stream`) | One-way server to browser push; plain HTTP, auto-reconnect built into `EventSource`. |
| Upload a PDF or image | `POST` to get a signed URL, then the browser does `PUT` straight to S3 | The file never passes through the API, so a big upload cannot tie up a server. |
| API to MongoDB | MongoDB wire protocol (binary, over TCP; TLS on Atlas; `mongodb+srv://` first does a DNS SRV lookup) | Driver-managed connection pool, reused by every request. |
| API to Redis | RESP over TCP | Shared counters and publish/subscribe across instances. |

### Why not WebSockets?
Everything the server pushes is one-way (a notification), and polling covers the rest. SSE is ordinary HTTP, so it needs no special proxy rules. A WebSocket becomes worth it when the collaborative editor arrives and both sides need to send many small messages quickly.

## Life of one request: liking a story

1. The click updates the page immediately (the app's own logic runs in the browser).
2. 400 ms later the sync layer compares local data with what the server already has and finds one new reaction.
3. `POST /api/v1/sync/ops` leaves with `Authorization: Bearer <access token>`.
4. Express runs the middleware chain in order: `helmet` (security headers), `cors`, `express.json` (parse body), request logger, router, `requireAuth` (verify the token with a signature check, no database call), `rateLimit`, `validate` (zod), then the handler.
5. The service checks the rules (you may only write your own records), assigns the next sequence number and upserts one document in MongoDB.
6. The JSON answer says how many operations were applied or rejected.
7. Another reader's browser asks `GET /sync/snapshot?since=N` on its next poll and receives the new like.

If any step fails, the error handler returns one consistent shape: `{ error: { code, message } }`.

## From a click to a response
1. **DNS** turns `api.example.com` into an IP address (or, for `mongodb+srv://`, finds the database hosts through an SRV record).
2. **TCP** three-way handshake (SYN, SYN-ACK, ACK) opens a reliable byte stream.
3. **TLS** handshake agrees on keys and proves the server's identity with a certificate, so the password and tokens are encrypted on the wire.
4. **HTTP** request and response travel over that stream. With keep-alive the same connection serves many requests, so the cost of steps 1 to 3 is paid once.

## HTTP the way the API uses it
| Idea | In the API |
|---|---|
| Methods | `GET` reads, `POST` creates or runs an action, `PUT` replaces (blobs), `PATCH` edits part, `DELETE` removes. |
| Idempotent | Repeating it gives the same result: `GET`, `PUT`, `DELETE`. `POST /tracking/events` is made safe by a unique event id. |
| Status codes | 200 ok, 201 created, 204 nothing to return, 401 not signed in, 403 not allowed, 404 not found, 422 bad input, 429 too many requests, 503 storage not configured. |
| Headers | `Authorization: Bearer ...` carries the access token; `Content-Type: application/json`; `helmet` adds security headers. |
| Stateless | The server keeps no session in memory. Any instance can answer any request, which is what lets a load balancer spread traffic. |

## CORS
A browser blocks a page on `localhost:3000` from reading answers of `localhost:4000` unless the API says it is allowed. For requests with an `Authorization` header the browser first sends an `OPTIONS` pre-flight; the `cors` middleware answers it using the list in `CORS_ORIGINS`. A phone app is not a browser, so CORS does not affect it.

## Authentication on the wire
- **Access token**: a short-lived (15 minutes) signed token. Checking it is pure arithmetic, no database lookup.
- **Refresh token**: a long random string stored in MongoDB per device. Each use replaces it with a new one; if an old one appears again, every session of that user is revoked (a sign it was stolen).
- **Server-Sent Events** cannot set headers in the browser, so that one route accepts the token as `?token=`. Tokens in URLs can land in logs, which is why the token is short-lived.

## Real-time: polling vs SSE vs WebSocket
| | How | Good for |
|---|---|---|
| Polling | Ask every N seconds | Simple, robust (used for the 15 s sync) |
| SSE | One open HTTP response, server writes events | One-way push (notifications) |
| WebSocket | Upgraded TCP connection, both sides send | Chat and collaborative editing (later) |

## Reliability and fairness
- **Rate limiting**: a counter per user (or IP) per minute. With Redis the count is shared by all instances; without it each process counts alone.
- **Retries**: the browser retries failed sends later. Unique event ids mean a retry after a lost response is not counted twice.
- **Timeouts and back-pressure**: a slow database makes requests wait; the connection pool limit stops the API from opening unlimited connections.
- **Load balancing**: nginx can sit in front of several API containers; because tokens are stateless, no "sticky" routing is needed.
- **Payload limits**: bodies above 2 MB are refused, so one request cannot flood the server.

## Questions you can be asked
- What happens between pressing Enter on a URL and seeing the page?
- Why is the refresh token stored on the server but the access token is not?
- When would you choose SSE over WebSockets?
- Why does a `POST` need an idempotency key and a `PUT` does not?
