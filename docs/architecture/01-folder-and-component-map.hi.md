# Folder और component map

Frontend का हर folder, उसमें क्या रहता है, और हर ज़रूरी file का एक काम। इसे index की तरह इस्तेमाल करें: पहले feature ढूँढें, फिर file खोलें।

## 1. सबसे ऊपर का स्तर

| Path | इसमें क्या है |
|---|---|
| `app/` | Next.js App Router के routes। हर URL का एक folder; `layout.tsx` हर पेज को लपेटता है। |
| `components/` | React components, feature के हिसाब से समूह में। |
| `contexts/` | पूरे app के React contexts: reading flow और navigation loader। |
| `hooks/` | पढ़ने वाली screens के लिए दोबारा काम आने वाले hooks (engine, breaks, shortcuts, fullscreen)। |
| `lib/` | Component के अलावा सब कुछ: API client, sync, session layer, editor engine, flip-reader engine, docs engine, शुद्ध helpers। |
| `types/` | साझा TypeScript types (`StoryData`, `QuestionAnswer`, `FontSettings` ...)। |
| `data/` | App के साथ आने वाली built-in stories और quiz content। |
| `docs/` | ये दस्तावेज़ (अंग्रेज़ी `.md` + हिंदी `.hi.md`)। |
| `scripts/` | Build helpers और unit tests (`*.test.ts`, `tsx` से चलते हैं)। |
| `public/` | Static files: landing video, images, copy किया हुआ pdf.js worker। |
| `next.config.js` | Security headers, cache headers, styled-components compiler, pdf.js के लिए `canvas` alias। |
| `tailwind.config.ts`, `app/globals.css` | Design tokens (`canvas`, `ink`, `overlay`, `accent-*`) और global styles। |
| `Dockerfile` | कई चरणों वाली (multi-stage) production image। |

## 2. Routes (`app/`)

| URL | File | Screen |
|---|---|---|
| `/` | `app/page.tsx` | Search landing, या story load हो तो story page |
| `/story/[id]` | `app/story/[id]/page.tsx` | किसी story का अपना, share होने लायक पेज |
| `/reader` | `app/reader/page.tsx` | Auto-scroll reader (text या media story) |
| `/read` | `app/read/page.tsx` | Speed wheel और हर पन्ने के समय के साथ free-scroll reading mode |
| `/questions` | `app/questions/page.tsx` | Quiz (MCQ, कई-विकल्प, संख्या वाले) हर सवाल के समय के साथ |
| `/results` | `app/results/page.tsx` | Score, topic के हिसाब से हिस्से, efficiency report; session को दर्ज करता है |
| `/dashboard` | `app/dashboard/page.tsx` | Home dashboard |
| `/history`, `/reading-history` | `app/history`, `app/reading-history` | Quiz attempts और पढ़ने का इतिहास |
| `/analytics` | `app/analytics/page.tsx` | Charts और contribution heatmap |
| `/settings` | `app/settings/page.tsx` | Account settings, password बदलना, reset |
| `/profile/[userId]` | `app/profile/[userId]/page.tsx` | Public profile, follows, QR code, समय का विश्लेषण |
| `/flipbook` | `app/flipbook/page.tsx` | Editor और export वाली PDF flip book |
| `/notes/[userId]`, `/notes/[userId]/docs/[slug]` | `app/notes/...` | Notes home और हर document पेज (यही site) |
| `/verify-email`, `/reset-password` | `app/verify-email`, `app/reset-password` | E-mail link वाले पेज (बिना sign-in खुलते हैं) |
| errors | `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | Error boundaries और 404 |
| `robots.txt` | `app/robots.ts` | सिर्फ़ landing page index हो सकता है |

App के सारे URL `lib/routes.ts` (`ROUTES`) से आते हैं, इसलिए कोई link अपने पेज से अलग नहीं भटक सकता।

## 3. Root layout: कौन किसे लपेटता है

`app/layout.tsx` पूरे app के providers को सोच-समझकर इस क्रम में रखता है:

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

यह क्रम क्यों: boundary सबसे बाहर होनी चाहिए ताकि user बदलने पर नीचे का हर provider reset हो; auth उसके अंदर होना चाहिए क्योंकि tokens हर user के लिए अलग रखे जाते हैं; gate को auth और reading state दोनों चाहिए।

## 4. Feature के हिसाब से components

| Folder | मुख्य files | काम |
|---|---|---|
| `components/Auth` | `DevLoginGate.tsx`, `SocialButtons.tsx` | Sign-in, sign-up, OTP verify, reset; Google Identity Services का button; backend status toast; `backendSync` शुरू और बंद करता है |
| `components/Navigation` | `TopNav`, `HamburgerMenu`, `NotificationBell`, `ProfileMenu`, `ThemePanel`, `ReadingStatus` | ऊपर की पट्टी, menu, unread badge और सूची, theme चुनना, "पढ़ रहे हैं" वाला dot |
| `components/Search` | `SearchBar` (782 lines), `AddStoryModal`, `QuestionsInput`, `PdfQuestionsModal`, `VoiceSearchOverlay`, `StoryCard`, `SaveToPlaylistPopover` | Keyboard navigation और history वाला search, आवाज़ से search (Web Speech API), text/PDF/images upload, quiz JSON जोड़ना, story cards |
| `components/Feed` | `PersonalizedFeed.tsx` | रुचि के हिसाब से क्रम वाला feed, infinite scroll के साथ (`IntersectionObserver`, एक बार में 6) |
| `components/Landing` | `StoryCarousel`, `PlatformShowcase`, `VideoShowcase`, `AudienceMarquee`, `LandingBackground` | Landing page के हिस्से और upload की गई backgrounds |
| `components/Dashboard` | `HomeDashboard`, `StoryHero`, `StoryPage`, `Dashboard` | Story page और पढ़ने से पहले की तैयारी |
| `components/Reader` | `Reader.tsx`, `MediaReader.tsx`, `useStoryHtml.ts` | Text और PDF/image stories के लिए auto-scroll track |
| `components/ReadingMode` | `ReadingModePage`, `ScrollRail`, `SpeedWheel`, `useInertiaScroll`, `useIdleDim` | Inertia, rail और idle होने पर धुंधलापन के साथ free-scroll reading |
| `components/Controls`, `Speedometer`, `ProgressBar`, `BreakTimer` | `Controls.tsx`, `CometDial.tsx` | Play/pause/WPM controls, animated speed dial, progress, break timer |
| `components/QuestionCard`, `Quiz` | `QuestionCard`, `QuestionTracker`, `QuestionText` | एक सवाल, tracker grid, code वाला सवाल का text |
| `components/ResultCard` | `ResultCard`, `TopicBreakdown`, `QuestionTimingBreakdown`, `ReadingEfficiencyReport` | Results और topic के हिसाब से accuracy (थोड़ी देर तक बदली जा सकती है) |
| `components/Content` | `ContentActions`, `CommentPanel`, `ShareModal`, `EditStoryModal` | Like/dislike, reactions वाले threaded comments, किसी व्यक्ति को share, अपनी story edit करना |
| `components/Profile` | `UserProfile`, `FollowList`, `ProfileQr`, `TimeAnalysisPanel`, `useAvatarUpload` | Profile, followers/following, public notes का QR, बिताया गया समय |
| `components/Account` | `CalendarPanel`, `CalendarYearView`, `ReadingHistoryPanel`, `TestAttemptsPanel`, `SettingsPanel`, `AnalyticsPanel` | Calendar (react-big-calendar), history tabs, settings |
| `components/Analytics` | `ContributionHeatmap`, `DailyTrendChart`, `EfficiencyTrends`, `Analytics` | Charts (Recharts) और GitHub जैसा heatmap |
| `components/Editor` | `EditorView`, `engine/EditorSurface`, `engine/HistoryStack`, `engine/TableOps`, `ui/Ribbon` | Rich-text story editor (देखें [Text editor](../TEXT_EDITOR.md)) |
| `components/FlipReader` | `reader/Reader`, `reader/PageEditor`, `flip-book/html-flip-book`, `reader/SearchPanel`, `reader/ImageEditor` | PDF flip book, page editor, search, covers (देखें [Flip book](../flip-book/README.md)) |
| `components/Notes` | `DocContent`, `PublicMenu`, `DocSearch`, `MermaidViewer`, `DocNav`, `DocTimeTracker` | यह documentation site |
| `components/Session` | `SessionBoundary`, `PresenceTracker` | User बदलने पर remount; पढ़ने की heartbeat |
| `components/ui` | `button`, `PasswordInput`, `ToastHost`, `Pagination`, `GlassSurface`, loaders | साझा building blocks और visual effects |

## 5. ज़िम्मेदारी के हिसाब से `lib/`

| Folder / file | काम |
|---|---|
| `lib/api/client.ts` | `apiFetch`: base URL, Bearer token, 401 पर single-flight refresh, `ApiError` |
| `lib/api/config.ts` | Backend URL, health URL, सोए server को जगाने के लिए `pingBackend()` |
| `lib/api/AuthContext.tsx` | Sign-up, login, Google, logout, password बदलना, session की दोबारा जाँच |
| `lib/api/endpoints.ts` | हर REST endpoint का एक typed function (auth, users, stories, social, notifications, playlists, history, uploads, calendar) |
| `lib/api/ScopedTokenStore.ts`, `tokenStore.ts` | Access और refresh tokens हर user के लिए अलग |
| `lib/api/backendSync.ts` | Social data sync: baseline diff से push, sequence cursor से pull, हर 15 s poll |
| `lib/api/backendTracking.ts` | पढ़ने के समय के events और per-user data blobs, queue में और idempotent |
| `lib/api/SyncingKeyValueStore.ts` | Decorator जो repository की हर write को backend तक भेजता है |
| `lib/api/syncPolicy.ts` | User कौन-से records push कर सकता है (server नियम की client copy) |
| `lib/api/offlineDemo*.ts` | Demo sign-in, सिर्फ़ तब जब backend तक पहुँच न हो |
| `lib/api/useNotificationStream.ts` | Live notifications के लिए SSE hook (तैयार है, अभी mount नहीं) |
| `lib/session/` | Per-user session: `SessionManager`, `UserSession`, `UserNamespace`, repositories, calculators (देखें [OOP architecture](../OOP_ARCHITECTURE.md)) |
| `lib/devData/` | Social data store (users, reactions, comments, shares, follows, playlists, notifications) |
| `lib/storage.ts` | Session layer के ऊपर पुराने `storage.*` नामों वाला facade |
| `lib/editor/` | Document model, HTML parser और sanitiser, code formatter, importers, exporters (DOCX, ZIP), autosave, edit lock |
| `lib/flipreader/` | PDF load, pagination, text निकालना और cache, search, overlays, image operations, PDF export, gestures |
| `lib/docs/` | Markdown renderer, highlighter, menu/library, i18n, generated bundles |
| `lib/readingPresence.ts` | "अभी पढ़ रहे हैं" का heartbeat model |
| `lib/readingMode/` | पन्नों में बाँटना और हर पन्ने पर बिताया समय |
| `lib/wpmCalculator.ts` | Word count, अवधि, speed bands |
| `lib/grading.ts`, `lib/questionImport.ts`, `lib/topicAnalytics.ts` | Quiz grading, quiz JSON की जाँच, topic के हिसाब से आँकड़े |
| `lib/qr.ts` | शुरू से लिखा QR encoder (GF(256) पर Reed-Solomon) |
| `lib/mediaStory.ts` | Upload की गई PDF या images को पढ़ने लायक story बनाता है |
| `lib/landingMedia.ts`, `lib/thumbnailVideo.ts` | बड़ी media IndexedDB में |
| `lib/toastBus.ts` | छोटी pub/sub toast queue |
| `lib/calendar/events.ts` | Calendar events: पहले backend, फिर local fallback |
| `lib/routes.ts`, `lib/publicRoutes.ts` | URL बनाने वाले functions और public-path नियम |

## 6. Hooks और contexts

| File | काम |
|---|---|
| `contexts/ReadingContext.tsx` | Reading flow के लिए reducer वाली state machine; state और dispatch अलग contexts में |
| `contexts/NavLoaderContext.tsx` | Navigation 150 ms से ज़्यादा ले तभी loader दिखाता है; 15 s बाद हार मान लेता है |
| `hooks/useReadingEngine.ts` | `requestAnimationFrame` loop जो progress बढ़ाता है और track को scroll करता है |
| `hooks/useBreakTracker.ts` | रुकावटें और break का समय गिनता है |
| `hooks/useAutoPause.ts` | Tab छिपने पर रोक देता है |
| `hooks/useKeyboardShortcuts.ts` | Space, arrows और reader के दूसरे shortcuts |
| `hooks/useFullscreen.ts`, `useOvertimeAlert.ts`, `useScrollToTopOnMount.ts` | Fullscreen API, समय से ज़्यादा होने की चेतावनी, scroll reset |

## 7. Tests (`scripts/`)

| File | Tests | क्या जाँचते हैं |
|---|---|---|
| `editor.test.ts` | 55 | Sanitiser, parser, document model, exporters, code formatter |
| `session-isolation.test.ts` | 23 | दो users कभी एक-दूसरे का data नहीं देखते; migration; token का दायरा |
| `docs.test.ts` | 15 | Markdown renderer की सुरक्षा और features; हर bundled doc render होता है |
| `presence.test.ts` | 8 | नकली घड़ी के साथ heartbeat, idle timeout, clamping |
| `quiz.test.ts` | 8 | MCQ, कई-विकल्प और संख्या वाली grading |
| `timelog.test.ts` | 8 | Time log records और सारांश |
| `topics.test.ts` | 4 | Topic analytics |
| `check-hi-docs.mjs` | script | हिंदी पेज अंग्रेज़ी का ढाँचा बनाए रखते हैं |
