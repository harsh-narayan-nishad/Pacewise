# Pacewise — Research README

> One page that records what was asked, what was built, what went wrong, what was learned, and why — across the whole working conversation on the Pacewise frontend.
> Written for the project owner (Harsh). Scope: the `speed-reader` Next.js app, its public notes site (QR code), the documents site, and the quiz system.

**How complete this is:** the full text of the earliest part of the conversation was compacted before this file was written, so those early items are recorded from the conversation summary (marked *summary*), while everything from the doc-page work onward is recorded from the actual exchanges and code (marked *direct*). Nothing here is invented to fill gaps; where a detail is not known it says so.

---

## 1. Project in one paragraph

**Pacewise** is a speed-reading and comprehension trainer: read a story at a chosen pace, take a quiz, get results and analytics, keep history, streaks and a daily-consistency calendar, upload your own stories (text, PDF, images) and edit them. It is a **Next.js 14 (App Router) + TypeScript (strict) + Tailwind** frontend with a deliberately object-oriented, per-user storage layer, a development login with 100 demo accounts, and (new in this stretch) a **public, no-login notes and documents site** reachable by scanning each user's QR code.

Design language ("the homepage language") that every new screen must follow: `font-display` headings with tight tracking, `rounded-[32px]` surfaces, brand blue `#306fdb`, floating-label fields, Apple-like restraint (glass navbar, pill buttons, generous spacing).

---

## 2. Working rules the owner set (and why they matter)

| Rule | Consequence in every round |
| --- | --- |
| "Do not change anything else" | Each change is additive and scoped; shared components are extended with optional props, never rewritten. |
| Follow the homepage design language everywhere | New UI reuses tokens (`bg-canvas`, `bg-canvas-raised`, `text-ink`, `text-ink-muted`, `border-overlay/10`), 32px radii, display type. |
| Docs must stay updated | `docs/QUIZ_AND_PROFILE.md` is the running feature document; new features are appended to it. |
| Deliver as a zip | `speed-reader-frontend.zip` after each round (excluding `node_modules`, `.next`). |
| Writes in English/Hinglish | Replies stay short, plain and direct. |
| Work is not run in the owner's browser by the assistant | The assistant verifies by tests, syntax checks and isolated rendering; real-browser confirmation is the owner's. |

---

## 3. Timeline of requests (what was asked, in order)

### 3.1 Earlier stretch (*summary*)
1. Replace the "Change photo" action with a **QR code**; add a **Notes** tab in the profile (CN, OS, OOP, DBMS: how each is used in Pacewise, with tradeoffs).
2. **Fix the wrong PDF owner** (an uploaded PDF showed another person as its owner).
3. Make the QR link open the **Vercel home address** ("pick home address for qr code link").
4. **Analytics / Apple-style restyles**: results page typography, graph container widths, Efficiency / Dashboard / History restyle, mobile responsiveness, audience images.
5. **Result-page and quiz upgrades** (six screenshots): standard widths for Accuracy and Pace graphs; remove the Apple-style pause button; "Time per question" list with lazy loading (10 at a time); correct **total test time** (from "Begin quiz" to Done/Finish); show **when** each test was started in history; quiz button with green stroke, white background and liquid effect; progress-bar sound like Apple; hover on a calendar day shows reading **and** test time; sign-in/sign-up page in the same design language.
6. **Strategic questions**: relevance of the software for a 2.5 Cr-package profile "if backend, monitoring and best engineering practices are integrated", plus a PDF-editor-like feature, rated out of 10; then "micro-level" security, distributed-systems thinking, YouTube-scale architecture, and algorithm design for a **test/revision notifier**. (Answered in chat; the research-grade version of that answer is in §7 and `docs/research/01-…`.)
7. **Deployment confusion**: a Vercel deployment URL showed "Ready" but did not show the update while the main domain did; the owner asked for the exact location and data flow of the updated link.
8. **Public notes by QR**: scanning the QR must show the notes **without login**, every doc as a web page, a navbar like the landing page, the same hamburger menu minus personal data, and a menu that contains every docs folder.

### 3.2 This stretch (*direct*)
9. **Doc-page upgrade** (docs pages only): OOP class diagram must behave like GitHub's Mermaid viewer (pan arrows, zoom, reset, expand, copy, drag); navbar hides on scroll-down and returns on scroll-up; a new **Research** section in the hamburger menu; bigger text in code boxes; highlighter + typography tools.
10. **Search bar** (a Uiverse design) added to the docs navbar, then **centred** in the navbar.
11. **Exact diagram and code rendering**: the diagram must match GitHub's image (orthogonal edges, proper arrows); every code sample must be colour-highlighted with indentation kept, showing **where** the code lives (file path) and **which principle** it demonstrates.
12. **Quiz JSON compatibility**: the GATE CS1 2026 question file (65 questions) was rejected by the quiz. Also: docs search must search all page content (not only folder names); remove the select-and-highlight feature from docs.
13. **Quiz extras**: code inside questions must show as code with indentation; the search bar must support dark mode; the quiz schema must accept optional **chapter**, **topic**, **year of appearance** (previous-year question) and a **note shown after the test**.
14. **Hydration error** on the notes/docs pages (reported twice; the first fix was wrong).
15. **This document.**

---

## 4. What was built (by area)

### 4.1 Per-user session layer (OOP, *summary* + code reviewed)
- `UserScopedRepository<T>` (abstract, Template Method): the base class owns key building, defensive JSON parsing, fallback to an empty value and writing; subclasses supply `feature()`, `emptyValue()` and optional `deserialize()`.
- `ListRepository<TItem>` (abstract, second and last level): array-valued features (`HistoryRepository`, `BookmarkRepository`, `AchievementRepository`, `CustomStoryRepository`, `SearchHistoryRepository`).
- `StreakRepository`, `DailyActivityRepository` (object/map values).
- `UserNamespace` (value object, private constructor + `forUser`): the only place that knows the key format `srt:v2:u:<id>:<feature>`.
- `KeyValueStore` interface with `BrowserKeyValueStore` and `MemoryKeyValueStore` (Dependency Inversion; tests use the memory store).
- `UserSession` (aggregate/facade, composition): one repository per feature, all bound to one namespace at construction; `clearAllData()` clears all polymorphically.
- `SessionManager` (registry + observer), `IdentityProvider` / `DevStoreIdentityProvider`, `LegacyDataMigrator`, `ScopedTokenStore`.
- Full explanation and the class diagram: `docs/OOP_ARCHITECTURE.md`.

### 4.2 Quiz and results (*summary* + direct)
- Timing: `quizStartedAt` at "Begin quiz", `quizFinishedAt` at Done/Finish; per-question **dwell time** summed across revisits; results show total test time separately from the average.
- Daily activity gained `testMs`, so the consistency calendar hover shows reading time **and** test time.
- Results page: Time-per-question list with "Show 10 more / Show less".
- **New question kinds** (direct): *select-all-that-apply* (`correctAnswer: [1,3]`) and *typed number* (`options: []`, numeric answer; whole numbers exact, decimals ±0.01 unless `tolerance` is given). Grading lives in `lib/grading.ts` (`questionKind`, `isAnswered`, `isCorrectAnswer`), used by the quiz, results and timing list.
- **Code in questions** (direct): `lib/questionText.ts` splits a question into prose and code (Markdown fences, or runs of code-looking lines); `components/Quiz/QuestionText.tsx` shows code with indentation, colours and horizontal scroll; multi-line options render as code too.
- **Optional labels** (direct): `chapter`, `topic`, `year` (aliases `pyqYear`, `yearOfAppearance`), `note`. Chapter/topic/year appear as chips above the question; the note appears on the results page. None are required; a malformed year is reported, never silently fixed.
- Sample and tests: `scripts/fixtures/gate-cs1-2026.json`, `scripts/quiz.test.ts`.

### 4.3 Public notes and documents site (*summary* + direct)
- Route `/notes/<userId>` and `/notes/<userId>/docs/<slug>` bypass the login gate and the app navbar (`lib/publicRoutes.ts`, `isPublicPath`).
- Documents are bundled **at build time** (`scripts/build-docs.mjs` → `lib/docs/generated.ts`, a titles-only `index.generated.ts` for client menus, and `search.generated.ts` for search) so it works on Vercel with no runtime file access. The credentials CSV is deliberately **not** bundled.
- A dependency-free Markdown→HTML renderer (`lib/docs/markdown.ts`) escapes everything first, then emits only its own tags; links resolve between docs; headings get anchors; fences become captioned code blocks or diagram holders.
- Hamburger menu: Notes, Documents (each folder expandable), a separate **Research** section, and "Open Pacewise".
- Navbar hides on scroll-down and returns on scroll-up (documents only).
- QR links always use the production domain `https://pacewise-delta.vercel.app` (override with `NEXT_PUBLIC_SITE_URL`); the QR encoder is a custom implementation (`lib/qr.ts`) verified by decoding.

### 4.4 Diagrams and code on doc pages (direct)
- `components/Notes/MermaidViewer.tsx`: drag to pan, arrow pad, zoom in/out (Ctrl/⌘ + scroll), reset (fit), full-screen expand, copy source; follows the site theme; falls back to the source text if rendering fails.
- Mermaid and the **ELK layout** load from a CDN on demand, which produces GitHub's look (orthogonal edges, line hops).
- `lib/docs/highlight.ts`: tiny tokenizer for ts/js/c/bash/json/css/nginx/yaml; fenced blocks can carry ` title="path/to/file.ts" principle="…" `, shown as a caption bar (path + language + Copy) and a "Principle" footer. Large ASCII trees stay plain but larger.
- Full-text search (`components/Notes/DocSearch.tsx`): index of every section; results show document › section with a highlighted snippet and jump to the section; loaded only when first used; centred pill that widens on hover/focus and follows the site theme.

---

## 5. Challenges and findings (problem → cause → fix → lesson)

| # | Problem | Root cause (finding) | Fix | Lesson |
| --- | --- | --- | --- | --- |
| 1 | QR code failed to decode for longer links (version 7+) | The "reserved modules" check also skipped **alignment patterns** (only finder-overlap positions must be skipped) | Corrected the reserved-area logic; verified by decoding with OpenCV | Verify encoders by decoding, not by eye |
| 2 | A PDF appeared to belong to another user | Large PDFs exceed **localStorage quota**; the write failed **silently**, and the ownership record lived in the same write, so it was lost; the app then fell back to the signed-in user | Ownership moved to a small separate list (`customStoryClaims`); `SessionManager.findCustomStoryOwner` checks it first; test added | Never store ownership in the same write as large content; treat storage failures as first-class |
| 3 | Vercel deployment URL did not show the update, but the domain did | Each deployment has its own permanent URL for *that build*; the production domain points at the latest **promoted** production deployment; deployment URLs can also be protected | Share the production domain (and use it in QR links) | Deployment URL = per-build preview; domain = what users see |
| 4 | Type errors under the lightweight type-check | Wrapper components did not declare `className/style/children`; `notFound()` return typing | Declared props explicitly; added `return null` after `notFound()` | Explicit prop types on wrappers |
| 5 | Doc diagram showed raw source, not a diagram | The viewer imported the `mermaid` npm package, which the owner's machine had not installed; the error was caught and the fallback source was shown | Load Mermaid + ELK from a CDN on demand (no install needed) | Don't make a feature depend on an install step the user may not have run |
| 6 | Diagram looked different from GitHub (curved, tangled edges) | Default layout is dagre with curved edges; GitHub's picture uses **ELK** orthogonal routing | Register `@mermaid-js/layout-elk` and use `layout: "elk"` (falls back to dagre if it fails); reproduced and screenshot-compared locally | Compare against the reference image, not memory |
| 7 | Search bar ignored dark mode | The pill used Tailwind `dark:` variants, but this app switches theme with **`data-theme` on `<html>`**, not the `dark` class | Styled with `:root[data-theme="dark"]` rules | Match the app's own theming mechanism |
| 8 | Quiz rejected the GATE JSON | Importer understood only single-choice (needed ≥2 options and one numeric index); the file has array answers and empty-option typed-number questions | Added the two question kinds end-to-end (import, quiz UI, grading, results, editor, export) | Parse the real file first; design the schema from real data |
| 9 | Hydration error "Text content does not match server-rendered HTML" (first fix wrong) | Two causes. (a) The "Shared by …" name came from browser storage, which the server cannot see (fixed first). (b) **The real, persistent cause:** inline `<style>{css}</style>` blocks containing `"` characters — React's server renderer HTML-escapes text inside `<style>` (`"` → `&quot;`) but browsers do not decode entities in `<style>`, so server and client text differed | Insert CSS via `dangerouslySetInnerHTML` in all three style blocks (doc content, search, quiz code) | In React, never put CSS with quotes/`<`/`&` as `<style>` children; and when a fix doesn't remove an error, look for a second cause |
| 10 | Highlighting tools requested then removed | Feature scope changed | Removed toolbar, saved marks and author highlight styling; deleted the annotation engine | Remove dead code with the feature |

---

## 6. Key insights (the short list)

1. **Isolation should be structural, not procedural.** Per-user data is safe because a repository can only be built with one `UserNamespace`, not because every call site remembers to pass a user id.
2. **Storage fails quietly.** localStorage quota errors, private-mode access errors and SSR have no `window`; every read/write needs a defensive path, and critical metadata must not share a write with bulky data.
3. **Server and client must render byte-identical first HTML.** Anything from browser storage, time, randomness or locale must be read after mount; inline `<style>` text with quotes is a trap.
4. **Public pages need a different trust model.** The QR notes site shows no personal data, bypasses login, bundles docs at build time, and excludes the demo-credentials CSV on purpose.
5. **Design from the real input.** The GATE file revealed two question kinds the schema lacked; a schema should be a superset of real data, with new fields optional and aliases tolerated.
6. **Match the reference by measurement.** Diagram fidelity (ELK vs dagre) and QR validity (decode test) were settled by reproducing and comparing, not by assumption.
7. **Make features not depend on setup steps.** CDN loading removed the "run npm install" failure mode.
8. **Use the app's own mechanisms.** Theme via `data-theme`, tokens via CSS variables, surfaces via `rounded-[32px]` — new UI should be indistinguishable from old.
9. **Additive change is how "don't change anything else" is honoured.** Optional props, optional JSON fields, new files — old behaviour is untouched and tests prove it (editor 55, session 23, presence 8, docs 8, quiz 8).
10. **Name the principle where the code lives.** Documentation that points to `path` + principle (Template Method, Composition, Value Object…) is verifiable: the reader can open the file.

---

## 7. Research notes (summaries of the research notes in `docs/research/`)

### 7.1 Scaling, security, and the revision notifier
- State must leave the browser: one source of truth per user behind an API; progress is write-heavy (partition by user), stories and notes are read-heavy (CDN + cache).
- Cheap security that prevents most incidents: hashed passwords, short-lived tokens, per-user authorisation on every query, rate limits on login and upload, validation at every boundary; uploads go straight to object storage via signed URLs, the server keeps only metadata + owner id.
- Monitoring: structured logs, request metrics (latency, errors), alerts on error **rate**, not single failures.
- **Notifier (spaced repetition):** after each test schedule the next review by score — below 50% next day; 50–80% in 3 days; above 80% in 7 days, doubling each time — with a scheduler that sends at most one reminder per user per day.
- Decision: keep the client-side design for now; when adding a backend move **state first, then uploads, then reminders**.
- Context of the original discussion (*summary*): relevance for a 2.5 Cr-package profile if a backend with monitoring and engineering best practices is added, YouTube-scale thinking, and algorithm design for the notifier. The honest framing: the *engineering judgement shown* (isolation, defensive storage, tests, documentation) matters more than raw scale claims.

### 7.2 Uploaded PDF ownership bug — see §5 #2.
### 7.3 Vercel deployments vs domain — see §5 #3.

---

## 8. Intentions — at what level this is being built

| Level | Intention | Evidence in the codebase |
| --- | --- | --- |
| **Product** | A polished, Apple-grade reading trainer whose design is consistent on every screen | Design tokens, 32px surfaces, homepage typography reused everywhere |
| **Engineering craft** | Readable, principled OOP with SOLID and named patterns, each linked to a file | `docs/OOP_ARCHITECTURE.md` with captioned code samples |
| **Quality** | Behaviour proven by tests, not claimed | 102 automated tests across five suites |
| **Reliability** | Fail soft: quota errors, SSR, private mode, missing CDN | Defensive repositories; diagram fallback; guarded storage |
| **Security & privacy** | Isolation by construction; public pages carry no personal data; secrets not bundled | `UserNamespace`, public-route design, CSV excluded |
| **Portfolio / career** | A showable system for senior full-stack roles: documentation site reachable by QR, architecture write-ups, research notes | Notes site, docs site, research section |
| **Future scale** | A clear path from client-only to backend (state → uploads → reminders), with monitoring and a spaced-repetition notifier | §7.1 |
| **Extensibility** | Drop in any block-level diagram or new quiz field without code changes | ` ```mermaid ` blocks; optional quiz schema |

---

## 9. How to use the new authoring features (quick reference)

**Documents (`docs/**/*.md`)**
- Diagram: a fenced block with language `mermaid` becomes the interactive viewer.
- Code with context: ` ```ts title="lib/session/UserSession.ts" principle="Composition over inheritance" `.
- Other writing tools: `++underline++`, `~~strike~~`, `***bold italic***`. (`==text==` now shows as plain text.)
- New folder = new menu group; a folder named `research` appears under **Research**.
- After editing docs run `node scripts/build-docs.mjs` (also runs on `predev`/`prebuild`).

**Quiz JSON**
```json
{
  "question": "…\n(code may be included with \\n and indentation, or in a ``` fence)",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": 1,
  "explanation": "Why.",
  "chapter": "Operating Systems",
  "topic": "Deadlock",
  "year": 2026,
  "note": "Shown after the test."
}
```
- Select-all: `"correctAnswer": [0, 2]`. Typed number: `"options": []`, `"correctAnswer": 4.25` (optionally `"tolerance"`).
- `chapter`, `topic`, `year`, `note` are all optional.

---

## 10. Known limitations and honest caveats
- The assistant has not run the app in the owner's browser; every browser-level behaviour (drag/zoom feel, scroll-hide navbar, search dropdown, hydration) is verified by reasoning, isolated rendering and tests only.
- Diagrams need internet access (CDN). Offline or CSP-restricted deployments would see the source text instead; bundling Mermaid locally is the alternative.
- Code detection in plain-text questions is heuristic; one-line code without line breaks is left as prose. Use fences for certainty.
- Docs search looks at titles, headings and body text but is a simple word-match (no typo tolerance or ranking beyond title > heading > body).
- Public documents are public to anyone with the link: do not put secrets in `docs/`.
- Notes shared via QR show the owner's name only when the viewing browser has that user stored locally.
- Next.js 14.2.5 is flagged as outdated by the dev overlay; upgrading is a separate task.

---

## 11. References

**Framework and web platform**
- Next.js — Text content does not match server-rendered HTML (hydration errors): https://nextjs.org/docs/messages/react-hydration-error
- Next.js App Router documentation: https://nextjs.org/docs/app
- React — `hydrateRoot` and hydration mismatches: https://react.dev/reference/react-dom/client/hydrateRoot
- React — `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
- MDN — Web Storage API and quota behaviour: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- MDN — `<style>` element (raw text content): https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style
- Tailwind CSS — dark mode (class vs media strategies): https://tailwindcss.com/docs/dark-mode
- Vercel — Deployments and domains: https://vercel.com/docs/deployments/overview and https://vercel.com/docs/projects/domains

**Diagrams**
- Mermaid documentation (class diagrams, configuration): https://mermaid.js.org/
- Mermaid layouts (ELK): https://mermaid.js.org/config/layouts.html
- Eclipse Layout Kernel (ELK): https://eclipse.dev/elk/
- GitHub — Creating diagrams (Mermaid in Markdown): https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams

**QR codes**
- ISO/IEC 18004 (QR code symbology) and the free summary at https://www.qrcode.com/en/about/standards.html
- Reed–Solomon error correction (background): https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction

**Object-oriented design**
- Gamma, Helm, Johnson, Vlissides — *Design Patterns* (Template Method, Observer, Facade, Registry-style access)
- Robert C. Martin — SOLID principles (Single responsibility, Open/closed, Liskov, Interface segregation, Dependency inversion)
- Eric Evans — *Domain-Driven Design* (Value Object, Aggregate Root)
- Project documents: `docs/OOP_ARCHITECTURE.md`, `docs/QUIZ_AND_PROFILE.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION_CHECKLIST.md`

**Learning science and revision scheduling**
- Ebbinghaus — forgetting curve: https://en.wikipedia.org/wiki/Forgetting_curve
- Wozniak — SM-2 spaced-repetition algorithm: https://super-memory.com/english/ol/sm2.htm
- Roediger & Karpicke (2006) — test-enhanced learning (retrieval practice improves retention)

**Security and distributed systems**
- OWASP Cheat Sheet Series (authentication, session management, file upload): https://cheatsheetseries.owasp.org/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Kleppmann — *Designing Data-Intensive Applications* (partitioning, caching, queues, monitoring)
- Google SRE Book — monitoring distributed systems (alert on symptoms and error rates): https://sre.google/sre-book/monitoring-distributed-systems/

**Quiz content**
- GATE CS1 2026 question set provided by the owner (65 questions), kept as `scripts/fixtures/gate-cs1-2026.json`.

---

## 12. Verification record (what was actually run)
- `npm test`: editor 55, session 23, presence 8, docs 8, quiz 8 — all passing at the last run.
- Docs renderer: escaping, link safety, tables, nested lists, fences, diagram holders, anchors, captioned code (indentation kept, tokens, principle).
- Quiz: the full GATE file imports with no issues; multi-select exact-set grading; numeric tolerance; optional labels; code-in-question splitting verified on questions 27, 34 and 39 of that file.
- Rendering checks in headless Chromium: the OOP diagram with ELK in dark theme matched the GitHub reference; the captioned code block rendered with colours, indentation, path, language and principle footer.
- Syntax checks (esbuild) across every `.ts/.tsx/.css`; strict `tsc` on the library files touched.
- **Not** verified by the assistant: behaviour inside the owner's browser and live Vercel deployment.

---

*End of document.*
