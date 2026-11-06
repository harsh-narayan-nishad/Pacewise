# Frontend

**Computer networks · Frontend.** How the Pacewise web app (Next.js + React, running in the browser) uses networking: every request it makes, how it stays fast on a slow connection and what it does when the network fails.

## What the browser does on every visit
1. **DNS lookup** for the site's domain, then **TCP** and **TLS** to open a secure connection.
2. **HTTP request** for the page; the response is HTML plus links to JavaScript and CSS files.
3. For each file the browser reuses the same connection (**keep-alive**, and **HTTP/2 multiplexing** when the host supports it), so many files travel in parallel over one connection.
4. **Caching**: files with a hash in the name (`/_next/static/...`) are marked cacheable for a long time, so a returning visitor downloads almost nothing.

## Where the app talks to the network
| What | Code | Protocol idea |
|---|---|---|
| All backend calls | `lib/api/client.ts` (`apiFetch`) | `fetch` over HTTPS, JSON body, `Authorization: Bearer <token>` |
| Token renewal | same file | On a **401**, one shared `/auth/refresh` call runs and every waiting request retries once (single-flight, so ten parallel requests do not send ten refreshes) |
| Sending changes | `lib/api/backendSync.ts` | Changes wait 400 ms (**debounce**), then go as one `POST /sync/ops` carrying up to 200 operations (**batching**) |
| Receiving changes | same file | **Polling**: `GET /sync/snapshot?since=N` every 15 s and when the tab becomes visible again |
| Reading time | `lib/api/backendTracking.ts` | Events queue in `localStorage`, go out in batches of 100, each with a unique id so a **retry** is safe |
| Live notifications | `lib/api/useNotificationStream.ts` | `EventSource` (**Server-Sent Events**): one long HTTP response; the browser reconnects by itself |
| PDF engine | `scripts/copy-pdf-worker.mjs` | The PDF worker file is served as a normal static file from `/pdf.worker.min.mjs` |
| Fonts | `app/layout.tsx` | `preconnect` to `fonts.googleapis.com` starts DNS + TCP + TLS early; `display=swap` shows text before the font arrives |
| Page changes | `next/link` | **Prefetch**: the next page's code is fetched when its link is visible, so clicking feels instant |

## Failure handling
- **Offline or server down**: sync and tracking never throw into the screen. The pending data stays queued (tracking queue is saved in `localStorage`, sync recomputes its difference) and is retried at the next change or poll.
- **Status codes**: 401 triggers a refresh; 403/404/422 become an `ApiError` the screen can show; 429 means slow down; 5xx means try later.
- **Idempotency**: a lost response must not double count reading time, so each event has a unique id and the server ignores repeats.
- **Cross-origin**: the browser asks the API (`OPTIONS` pre-flight) whether the site may call it; the API answers with the allowed origins.

## Security on the wire
- All traffic is HTTPS, so tokens and passwords are encrypted in transit.
- Access tokens live for minutes; the refresh token is rotated on every use.
- The notification stream puts the token in the URL because `EventSource` cannot set headers; that is why the token is short-lived.

## Known network weaknesses (from the investigation)
- The Google Fonts stylesheet blocks first paint if that host is slow or blocked; self-hosting the fonts with `next/font` removes the external request.
- The login screen waits for JavaScript before showing content, so slow networks feel slower.
- The landing video should use `preload="metadata"` so it does not compete with scripts for bandwidth.

## Questions you can be asked
- What happens when you type a URL and press Enter?
- Why debounce and batch requests? What is the cost of each?
- Polling, SSE or WebSocket for this feature, and why?
- How do you stop ten failed requests from sending ten token refreshes?
