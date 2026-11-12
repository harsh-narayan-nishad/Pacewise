# Folder and component map

Every folder of the frontend, what lives in it, and the one job each important file does. Use it as an index: find the feature, then open the file.

## 1. Top level

| Path | What it holds |
|---|---|
| `app/` | Next.js App Router routes. One folder per URL; `layout.tsx` wraps every page. |
| `components/` | React components, grouped by feature. |
| `contexts/` | App-wide React contexts: the reading flow and the navigation loader. |
| `hooks/` | Reusable hooks for the reading screens (engine, breaks, shortcuts, fullscreen). |
| `lib/` | Everything that is not a component: API client, sync, session layer, editor engine, flip-reader engine, docs engine, pure helpers. |
| `types/` | Shared TypeScript types (`StoryData`, `QuestionAnswer`, `FontSettings` ...). |
| `data/` | Built-in stories and quiz content shipped with the app. |
| `docs/` | These documents (English `.md` + Hindi `.hi.md`). |
| `scripts/` | Build helpers and the unit tests (`*.test.ts`, run with `tsx`). |
| `public/` | Static files: landing video, images, the copied pdf.js worker. |
| `next.config.js` | Security headers, cache headers, styled-components compiler, the `canvas` alias for pdf.js. |
| `tailwind.config.ts`, `app/globals.css` | Design tokens (`canvas`, `ink`, `overlay`, `accent-*`) and global styles. |
| `Dockerfile` | Multi-stage production image. |

## 2. Routes (`app/`)

| URL | File | Screen |
|---|---|---|
| `/` | `app/page.tsx` | Search landing, or the story page when a story is loaded |
| `/story/[id]` | `app/story/[id]/page.tsx` | One story's own, shareable page |
| `/reader` | `app/reader/page.tsx` | Auto-scroll reader (text or media story) |
| `/read` | `app/read/page.tsx` | Free-scroll reading mode with speed wheel and page dwell time |
| `/questions` | `app/questions/page.tsx` | Quiz (MCQ, multi-select, numeric) with per-question timing |
| `/results` | `app/results/page.tsx` | Score, topic breakdown, efficiency report; records the session |
| `/dashboard` | `app/dashboard/page.tsx` | Home dashboard |
| `/history`, `/reading-history` | `app/history`, `app/reading-history` | Quiz attempts and reading history |
| `/analytics` | `app/analytics/page.tsx` | Charts and the contribution heatmap |
| `/settings` | `app/settings/page.tsx` | Account settings, password change, reset |
| `/profile/[userId]` | `app/profile/[userId]/page.tsx` | Public profile, follows, QR code, time analysis |
| `/flipbook` | `app/flipbook/page.tsx` | PDF flip book with editor and export |
| `/notes/[userId]`, `/notes/[userId]/docs/[slug]` | `app/notes/...` | Notes home and every document page (this site) |
| `/verify-email`, `/reset-password` | `app/verify-email`, `app/reset-password` | E-mail link landing pages (open without sign-in) |
| errors | `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | Error boundaries and 404 |
| `robots.txt` | `app/robots.ts` | Only the landing page is indexable |

All in-app URLs come from `lib/routes.ts` (`ROUTES`), so a link cannot drift from its page.

## 3. The root layout: who wraps whom

`app/layout.tsx` nests the app-wide providers in a deliberate order:

```text
SessionBoundary            key = active user id; remounts everything on a user switch
  AuthProvider             backend session: login, Google, logout, /auth/me check
    ReadingProvider        reading-flow reducer (phase, WPM, answers ...)
      ThemeSync            applies the saved theme to <html>
      PresenceTracker      5 s heartbeat for "reading now" time
      DevLoginGate         sign-in screen until someone is signed in; starts backend sync
        NavLoaderProvider  full-screen loader for slow navigations
          TopNav / <main> / Footer
      ToastHost            renders the toast queue
```

Why this order: the boundary must be outermost so a user switch resets every provider below it; auth must sit inside it because tokens are stored per user; the gate needs both auth and the reading state.

## 4. Components by feature

| Folder | Key files | Job |
|---|---|---|
| `components/Auth` | `DevLoginGate.tsx`, `SocialButtons.tsx` | Sign-in, sign-up, OTP verify, reset; Google Identity Services button; backend status toast; starts and stops `backendSync` |
| `components/Navigation` | `TopNav`, `HamburgerMenu`, `NotificationBell`, `ProfileMenu`, `ThemePanel`, `ReadingStatus` | Top bar, menu, unread badge and list, theme picker, live "reading" dot |
| `components/Search` | `SearchBar` (782 lines), `AddStoryModal`, `QuestionsInput`, `PdfQuestionsModal`, `VoiceSearchOverlay`, `StoryCard`, `SaveToPlaylistPopover` | Search with keyboard navigation and history, voice search (Web Speech API), upload text/PDF/images, add quiz JSON, story cards |
| `components/Feed` | `PersonalizedFeed.tsx` | Interest-ranked feed with infinite scroll (`IntersectionObserver`, 6 per page) |
| `components/Landing` | `StoryCarousel`, `PlatformShowcase`, `VideoShowcase`, `AudienceMarquee`, `LandingBackground` | Landing page sections and uploaded backgrounds |
| `components/Dashboard` | `HomeDashboard`, `StoryHero`, `StoryPage`, `Dashboard` | Story page and pre-reading setup |
| `components/Reader` | `Reader.tsx`, `MediaReader.tsx`, `useStoryHtml.ts` | Auto-scroll track for text and for PDF/image stories |
| `components/ReadingMode` | `ReadingModePage`, `ScrollRail`, `SpeedWheel`, `useInertiaScroll`, `useIdleDim` | Free-scroll reading with inertia, rail, idle dimming |
| `components/Controls`, `Speedometer`, `ProgressBar`, `BreakTimer` | `Controls.tsx`, `CometDial.tsx` | Play/pause/WPM controls, animated speed dial, progress, break timer |
| `components/QuestionCard`, `Quiz` | `QuestionCard`, `QuestionTracker`, `QuestionText` | One question, the tracker grid, question text with code |
| `components/ResultCard` | `ResultCard`, `TopicBreakdown`, `QuestionTimingBreakdown`, `ReadingEfficiencyReport` | Results and per-topic accuracy (editable for a short window) |
| `components/Content` | `ContentActions`, `CommentPanel`, `ShareModal`, `EditStoryModal` | Like/dislike, threaded comments with reactions, share to a person, edit own story |
| `components/Profile` | `UserProfile`, `FollowList`, `ProfileQr`, `TimeAnalysisPanel`, `useAvatarUpload` | Profile, followers/following, QR to public notes, time spent |
| `components/Account` | `CalendarPanel`, `CalendarYearView`, `ReadingHistoryPanel`, `TestAttemptsPanel`, `SettingsPanel`, `AnalyticsPanel` | Calendar (react-big-calendar), history tabs, settings |
| `components/Analytics` | `ContributionHeatmap`, `DailyTrendChart`, `EfficiencyTrends`, `Analytics` | Charts (Recharts) and a GitHub-style heatmap |
| `components/Editor` | `EditorView`, `engine/EditorSurface`, `engine/HistoryStack`, `engine/TableOps`, `ui/Ribbon` | Rich-text story editor (see [Text editor](../TEXT_EDITOR.md)) |
| `components/FlipReader` | `reader/Reader`, `reader/PageEditor`, `flip-book/html-flip-book`, `reader/SearchPanel`, `reader/ImageEditor` | PDF flip book, page editor, search, covers (see [Flip book](../flip-book/README.md)) |
| `components/Notes` | `DocContent`, `PublicMenu`, `DocSearch`, `MermaidViewer`, `DocNav`, `DocTimeTracker` | This documentation site |
| `components/Session` | `SessionBoundary`, `PresenceTracker` | Per-user remount; reading heartbeat |
| `components/ui` | `button`, `PasswordInput`, `ToastHost`, `Pagination`, `GlassSurface`, loaders | Shared building blocks and visual effects |

## 5. `lib/` by responsibility

| Folder / file | Job |
|---|---|
| `lib/api/client.ts` | `apiFetch`: base URL, Bearer token, single-flight refresh on 401, `ApiError` |
| `lib/api/config.ts` | Backend URL, health URL, `pingBackend()` to wake a sleeping server |
| `lib/api/AuthContext.tsx` | Sign-up, login, Google, logout, change password, session re-check |
| `lib/api/endpoints.ts` | One typed function per REST endpoint (auth, users, stories, social, notifications, playlists, history, uploads, calendar) |
| `lib/api/ScopedTokenStore.ts`, `tokenStore.ts` | Access and refresh tokens stored per user |
| `lib/api/backendSync.ts` | Social data sync: baseline diff push, sequence-cursor pull, 15 s poll |
| `lib/api/backendTracking.ts` | Reading-time events and per-user data blobs, queued and idempotent |
| `lib/api/SyncingKeyValueStore.ts` | Decorator that mirrors repository writes to the backend |
| `lib/api/syncPolicy.ts` | Which records the user may push (client mirror of the server rule) |
| `lib/api/offlineDemo*.ts` | Demo sign-in only when the backend is unreachable |
| `lib/api/useNotificationStream.ts` | SSE hook for live notifications (ready, not yet mounted) |
| `lib/session/` | Per-user session: `SessionManager`, `UserSession`, `UserNamespace`, repositories, calculators (see [OOP architecture](../OOP_ARCHITECTURE.md)) |
| `lib/devData/` | Social data store (users, reactions, comments, shares, follows, playlists, notifications) |
| `lib/storage.ts` | Facade with the old `storage.*` function names over the session layer |
| `lib/editor/` | Document model, HTML parser and sanitiser, code formatter, importers, exporters (DOCX, ZIP), autosave, edit lock |
| `lib/flipreader/` | PDF loading, pagination, text extraction and cache, search, overlays, image operations, PDF export, gestures |
| `lib/docs/` | Markdown renderer, highlighter, menu/library, i18n, generated bundles |
| `lib/readingPresence.ts` | Heartbeat model of "reading now" |
| `lib/readingMode/` | Page splitting and per-page dwell time |
| `lib/wpmCalculator.ts` | Word counts, durations, speed bands |
| `lib/grading.ts`, `lib/questionImport.ts`, `lib/topicAnalytics.ts` | Quiz grading, quiz JSON validation, per-topic stats |
| `lib/qr.ts` | QR encoder written from scratch (Reed-Solomon over GF(256)) |
| `lib/mediaStory.ts` | Turns an uploaded PDF or images into a readable story |
| `lib/landingMedia.ts`, `lib/thumbnailVideo.ts` | Large media kept in IndexedDB |
| `lib/toastBus.ts` | Tiny pub/sub toast queue |
| `lib/calendar/events.ts` | Calendar events: backend first, local fallback |
| `lib/routes.ts`, `lib/publicRoutes.ts` | URL builders and the public-path rule |

## 6. Hooks and contexts

| File | Job |
|---|---|
| `contexts/ReadingContext.tsx` | Reducer-based state machine for the reading flow; state and dispatch in separate contexts |
| `contexts/NavLoaderContext.tsx` | Shows a loader only if navigation takes longer than 150 ms; gives up after 15 s |
| `hooks/useReadingEngine.ts` | `requestAnimationFrame` loop that advances progress and scrolls the track |
| `hooks/useBreakTracker.ts` | Counts pauses and break time |
| `hooks/useAutoPause.ts` | Pauses when the tab is hidden |
| `hooks/useKeyboardShortcuts.ts` | Space, arrows and other reader shortcuts |
| `hooks/useFullscreen.ts`, `useOvertimeAlert.ts`, `useScrollToTopOnMount.ts` | Fullscreen API, over-time warning, scroll reset |

## 7. Tests (`scripts/`)

| File | Tests | Covers |
|---|---|---|
| `editor.test.ts` | 55 | Sanitiser, parser, document model, exporters, code formatter |
| `session-isolation.test.ts` | 23 | Two users never see each other's data; migration; token scoping |
| `docs.test.ts` | 15 | Markdown renderer safety and features; every bundled doc renders |
| `presence.test.ts` | 8 | Heartbeat, idle timeout, clamping with a fake clock |
| `quiz.test.ts` | 8 | MCQ, multi-select and numeric grading |
| `timelog.test.ts` | 8 | Time log records and summaries |
| `topics.test.ts` | 4 | Topic analytics |
| `check-hi-docs.mjs` | script | Hindi pages keep the English structure |
