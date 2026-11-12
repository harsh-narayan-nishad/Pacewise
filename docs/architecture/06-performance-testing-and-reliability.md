# Performance, testing and reliability

What makes the frontend fast, how it is tested, how it behaves when things fail, and what is still weak. The JD asks for "performance analysis", "unit/integration testing" and "high quality standards", so each section ends with what to measure or improve.

## 1. Rendering performance

| Technique | Where | Effect |
|---|---|---|
| `requestAnimationFrame` loop with progress as the source of truth | `hooks/useReadingEngine.ts` | One update per frame; changing the font never jumps the percentage |
| `ResizeObserver` on the track | same | Recomputes only the scroll position on reflow |
| Rolling 4-second WPM window | same | Smooth speedometer without storing every sample |
| Split state and dispatch contexts | `contexts/ReadingContext.tsx` | Components that only dispatch never re-render on state changes |
| `useSyncExternalStore` | stores, session, toasts | Consistent reads in concurrent rendering |
| Infinite scroll in pages of 6 | `components/Feed/PersonalizedFeed.tsx` | Small first render; more cards only when the sentinel is visible |
| Virtualised pages, worker parsing, LRU caches, cancellation | `lib/flipreader`, `components/FlipReader` | Large PDFs stay smooth; see [Rendering and performance](../flip-book/02-rendering-and-performance.md) |
| Lazy Mermaid and search index | `components/Notes/MermaidViewer.tsx`, `DocSearch.tsx` | Heavy code is fetched only when a diagram or the search box is used |
| Navigation loader after 150 ms only | `contexts/NavLoaderContext.tsx` | Fast pages never flash a spinner |
| `passive: true` activity listeners | `PresenceTracker` | Scrolling is never blocked by the heartbeat's listeners |

## 2. Loading performance and Core Web Vitals

- **LCP (Largest Contentful Paint):** the landing hero and video. Use `preload="metadata"` on the video and a poster image; serve images in modern formats.
- **INP (Interaction to Next Paint):** long tasks are the enemy. The synchronous `localStorage` snapshot write after every social action is the main risk; debounce it or move to IndexedDB.
- **CLS (Cumulative Layout Shift):** fixed sizes for cards and avatars; the empty first paint of the gate avoids layout jumps from hydration.
- **Fonts:** Google Fonts with `preconnect` and `display=swap`. Self-hosting with `next/font` removes a blocking third-party request.
- **Caching:** hashed `/_next/static` files are cached long-term; `/videos/*` gets `max-age=31536000, immutable` in `next.config.js`.
- **Code splitting:** each route is its own chunk; pdf.js and Mermaid load on demand.

**How to measure:** Chrome DevTools Performance panel (long tasks, main-thread flame chart), Lighthouse for lab numbers, the `web-vitals` library for field numbers sent to analytics, React DevTools Profiler for wasted renders, and the Memory panel (heap snapshots) for leaks in the flip book.

## 3. Testing

| Level | What exists | How it runs |
|---|---|---|
| Unit | 121 tests across editor (55), session isolation (23), docs (15), presence (8), quiz (8), time log (8), topics (4) | `npx tsx scripts/<name>.test.ts`; `npm test` runs editor + session |
| Type checks | `strict` TypeScript over the whole app | `npm run typecheck` |
| Docs checks | Renderer safety tests; Hindi parity checker | `scripts/docs.test.ts`, `node scripts/check-hi-docs.mjs` |
| Lint | Next.js ESLint config, run in CI, not during build | `npm run lint` |

What makes the code testable: pure logic outside React, injected clocks (`ReadingPresence` takes `now`), injected storage (`MemoryKeyValueStore`), and injected identity (`IdentityProvider`).

**Known gap:** `npm run typecheck` currently reports three errors in `scripts/editor.test.ts` (a `Promise<ExportResult>` union is not awaited before `.data`). The app code itself type-checks.

**What a senior would add next:**
- Component tests with React Testing Library for the sign-in gate, comment panel and quiz.
- End-to-end tests with Playwright: sign in, read, finish a quiz, see history; like on one account, see the notification on another.
- Contract tests between `lib/api/endpoints.ts` and the backend's OpenAPI schema.
- A CI pipeline: typecheck, lint, unit tests, Hindi parity check, build, Lighthouse budget.

## 4. Failure handling

| Failure | Behaviour |
|---|---|
| Backend asleep or down | UI keeps working from local data; sync and tracking stay queued; demo accounts can sign in offline; the sign-in screen says "Backend not connected" |
| Access token expired | One shared refresh, then the original request is retried once |
| Refresh token invalid | Tokens cleared; person signed out |
| Account banned while signed in | `403` with an `ACCOUNT_*` code clears the session and reloads |
| `localStorage` full or blocked | Writes are wrapped in `try/catch`; the app keeps working in memory for the session |
| Corrupt stored JSON | Repositories fall back to the empty value instead of crashing |
| Render crash | `app/error.tsx` and `app/global-error.tsx` show a recovery screen |
| Tab closed mid-session | Tracking queue is persisted; `pagehide` flushes presence; autosave flushes on hide |
| Two tabs editing one document | Lease lock: the tab that cannot acquire it opens the document read-only |
| Laptop sleeps during reading | Presence adds at most two heartbeats of time per beat |

## 5. Security checklist (frontend side)

- HTTPS everywhere; tokens never logged.
- Security headers in `next.config.js`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` (clickjacking), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` allowing only the microphone (voice search); `X-Powered-By` removed.
- All story HTML passes the editor's sanitiser; docs Markdown is escaped first and `javascript:` links are dropped.
- `robots.ts` keeps account and reading pages out of search engines.
- Open items: add a Content-Security-Policy; move the refresh token to an httpOnly cookie; the SSE token in the query string should be a short-lived, single-purpose token.

## 6. Observability (what to add)

- Client error reporting (for example Sentry) from the error boundaries and `ApiError`s.
- Web Vitals and custom timings (time to first story, quiz completion rate) sent to analytics.
- A sync status indicator: `backendSync` already exposes `subscribe` / `getStatus` (`off`, `connecting`, `online`, `offline`).
- Experiment flags for A/B tests (onboarding copy, feed ranking) with exposure logging, so a product change can be measured before full rollout.
