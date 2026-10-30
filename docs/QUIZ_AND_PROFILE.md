# Quiz tracker, quiz-only mode, and profile tabs

## Quiz page (`app/questions/page.tsx`)
- Two columns: the question on the left, `components/Quiz/QuestionTracker.tsx` on the right (stacks on small screens).
- Tracker = `components/ui/AnimatedList.tsx` (React Bits, themed with the app tokens through its `style` prop, so it follows dark/light/sepia).
- Each question shows: **Completed**, **Marked for review**, **Skipped** or **Not answered**; header shows "X of N completed".
- Rows show the question text. Three round green buttons under the list filter it: Completed / Marked for review / Not completed (click again to clear; each shows a count). Clicking a row jumps to that question. The quiz is finished with **Finish** on the last question. The panel is borderless, translucent and blurred, and the page uses the same inertial scrolling as the home page.
- "Begin quiz" now dispatches the chosen question count (`GO_TO_QUESTIONS`), preserving `quizOnly`.

## Quiz only (no reading)
- "Quiz only" button in the story hero → `GO_TO_QUESTIONS { quizOnly: true }`.
- Results are saved as a history entry with `wpm: 0` (excluded from the speed chart); no reading session is created; ResultCard hides the reading/speed rows.

## Profile tabs (own profile only)
- Dashboard / Reading history / Analytics / Past test attempts / Settings now swap the content area in place of "Content posted by you"; click the active pill again to return.
- Content lives in `components/Account/*Panel.tsx`; the old routes (`/history`, `/reading-history`, `/analytics`, `/settings`) reuse the same panels and look unchanged.
- Other users' profiles still show posts only.

Note: AnimatedList's demo icon imports (hugeicons) were removed; not verified in a browser (no build available in the sandbox).

## Analytics layout (apple.com-inspired)
- Reading speed / Accuracy: two large rounded cards side by side (stacked on mobile) with a centred title, a trend line, an average in brand blue, and the graph below.
- Consistency (streaks / active days / reading time) and Daily pace: a left-aligned display heading with a blue note on the right, one large card with a two-line caption, then a pill of dots + round play button (`components/Analytics/PagerPill.tsx`). Dots step through the stats (or the latest days for pace); play auto-advances, and starts paused for reduced-motion users.
- Data, calculations and tooltips are unchanged.
- Efficiency, Dashboard, Reading history and Past test attempts use the same rounded-[32px] card language (blue notes, display headings, pager on Efficiency).

## Notes, QR code and public link
- New **Notes** tab (between Dashboard and Reading history): how CN, OS, OOP and DBMS are used in this project, each with a "Used here" and a "Tradeoff" line. Content lives in `lib/notesContent.ts`; one view (`components/Notes/NotesView.tsx`) serves the tab and the public page.
- On your own profile a QR code (`components/Profile/ProfileQr.tsx`) replaced the Change photo button; click your avatar to change the photo. The QR is built from the signed-in user's id (`lib/qr.ts`, no dependency, tested by decoding), so each user gets a different one. Under it, "Copy notes link".
- The QR opens `/notes/<userId>`, which needs no login (`lib/publicRoutes.ts`, bypassed in `DevLoginGate`, navbar hidden). The link always points at the deployed app; set `NEXT_PUBLIC_SITE_URL` to override; the default is the deployed Vercel address in `lib/publicRoutes.ts` (`SITE_ORIGIN`), so the QR works from a phone even when running locally.

## Uploaded-PDF owner fix
A PDF's pages are images, so a big one can exceed the ~5 MB browser storage quota; the save failed silently and the story then looked like it belonged to someone else. `CustomStoryRepository` now also records the uploader's id in a tiny separate list (`customStoryClaims`), and `SessionManager.findCustomStoryOwner` checks it. Test: `scripts/session-isolation.test.ts`. A PDF too big to store still opens for the session but is not kept in the library.

## Test timing (start to finish)
- `ReadingContext` stores `quizStartedAt` (set when "Begin quiz" is pressed, via `GO_TO_QUESTIONS`) and `quizFinishedAt` (set by `GO_TO_RESULTS`). **Total test time = finish - start**, shown on the results page, the quiz panel (live), and in history.
- Per-question time is the sum of every visit to that question (`flushDwell` in `app/questions/page.tsx`), so revisits and unanswered questions are counted.
- History entries have `quizStartedAt`; "Past test attempts" shows "Started 10:42 AM · took 12:03".
- Each finished test adds its duration to that day's `testMs` (`DailyActivityRepository.recordTestTime`); the consistency tracker's hover card shows total reading time and total test time, and a test-only day counts as active.
- Leaving mid-quiz without finishing records nothing (there is no result to attach it to).

## Results page and visual system
- Results use the site width (`max-w-6xl`) and the apple.com home-page tile grid: one score tile (rating, copy, two pills, all numbers), then Reading speed and Accuracy tiles side by side (`TrendTiles`), Time per question (10 rows at a time, "Show 10 more" / "Show less"), efficiency, and the remaining analytics. The Analytics page uses the same width (`PageShell wide`).
- The pager under showcase cards is dots only (no play/pause, no auto-advance).
- Hover cards share one style (`lib/chartStyle.ts`).
- Quiz panel: progress shown like the macOS volume HUD inside a liquid-glass container (`components/ui/LiquidGlass.tsx`, the navbar's `GlassSurface`), a separate live "Total test time", and white round filter buttons with green strokes.
- Sign-in / sign-up screens use the same card, display heading, underlined fields and pill tabs as the rest of the app. Behaviour is unchanged.

## Public notes site (QR code) - documents as web pages
- `/notes/<userId>` (no login) shows the notes, then every document of this `docs/` folder; `/notes/<userId>/docs/<slug>` shows one document as a web page. Links between documents work, and `#section` links jump to headings.
- The page has the landing navbar (glass bar, hamburger and name on the left, theme switch on the right). The hamburger has no personal data (no playlists, search history, uploads or sign-out); it lists the notes and one row per docs folder (**Project docs**, **Interview prep**). Opening a folder lists its documents; the one being read is highlighted.
- How it works: `scripts/build-docs.mjs` bundles `docs/**/*.md` into `lib/docs/generated.ts` (full text, server only) and `lib/docs/index.generated.ts` (titles only, used by the menu). It runs automatically before `dev` and `build`, so new or edited docs appear without extra steps; run `npm run docs:build` to refresh by hand. `lib/docs/markdown.ts` turns Markdown into escaped HTML (tests: `npm run test:docs`).
- Only `.md` files are published. `docs/DEMO_ACCOUNTS.csv` (demo passwords) is deliberately excluded. Anything you write in a `docs/*.md` file becomes public through the QR link, so keep secrets out of those files.

## Document pages (public notes)

- **Diagrams** written as Mermaid blocks are interactive: drag to pan, arrow pad, zoom in/out (Ctrl/⌘ + scroll), reset, expand to full screen, copy source. Needs the `mermaid` package (`npm install`).
- **Navbar** on document pages hides when scrolling down and returns on any scroll up.
- **Research** has its own section in the hamburger menu, fed by `docs/research/*.md`.
- **Writing tools** for authors: `++underline++`, `~~strike~~`, `***bold italic***`. (`==text==` is accepted but shows as plain text; readers have no select-to-highlight tool on document pages.)
- Code blocks use a larger font.
- **Search** in the centre of the public navbar: a pill that widens on hover/focus; it searches all text on the pages (titles, headings, body, code), shows a snippet with the match highlighted and opens that section; Enter opens the first result. The index is generated into `lib/docs/search.generated.ts` by `scripts/build-docs.mjs` and loaded only when the search is used.
- **Diagrams** now load Mermaid + the ELK layout from a CDN (no `npm install` needed) and draw like GitHub's viewer (orthogonal arrows).
- **Code blocks** are syntax-coloured with indentation kept. Write ` ```ts title="path/to/file.ts" principle="What principle it shows" ` to show the file path on top and the principle underneath. Any ` ```mermaid ` block becomes an interactive diagram, so new block diagrams can be added the same way.
- The search bar sits in the centre of the navbar.

## Question types (quiz JSON)

Besides single-choice, the quiz JSON can contain:

- **Select all that apply** — `"correctAnswer": [0, 2]` (indexes, letters or option texts). Marked right only when exactly that set is chosen.
- **Typed number** — `"options": []` and `"correctAnswer": 4.25`. Whole numbers must match exactly; decimals are accepted within ±0.01 (set `"tolerance"` to change).

The quiz shows checkboxes or a number box with a **Check answer** button (leaving the question submits what was entered), and results, timing and accuracy use the same grading (`lib/grading.ts`). A sample is in `scripts/fixtures/gate-cs1-2026.json`; tests are in `scripts/quiz.test.ts`.

## Quiz JSON: optional labels and code in questions

- Each question may also carry these **optional** fields (none are required): `chapter`, `topic`, `year` (year the previous-year question appeared, e.g. `2026`; also accepted as `pyqYear`) and `note` (shown on the results page after the test). Chapter, topic and year appear as small chips above the question while taking the quiz. The one-by-one editor has matching optional boxes.
- **Code in a question** is shown as a code block with its indentation and line breaks kept and syntax colours. Write it in the JSON with `\n` line breaks (and spaces for indentation), or wrap it in a Markdown fence inside the string (```` ```c … ``` ````). Plain-text questions with pasted code lines are detected automatically. Options that span several lines are shown as code too.

## Syllabus section, layering, and the quiz schema panel

- **Syllabus**: a menu section (below Research) fed by `docs/syllabus/*.md`: chapter 1 *Pacewise* (sub-systems A–T and the hard engineering areas) and placeholders for chapters 2–8; `docs/syllabus/README.md` is the index.
- **Layering on doc pages** (top to bottom): menu drawer (z 110) → its backdrop (100) → navbar and its search dropdown (95) → full-screen diagram (90, sits under the navbar) → page content.
- **Quiz schema panel**: the JSON / file tab of the question uploader (shared by Add story, Edit story and the PDF questions dialog) lists every accepted field, its type, whether it is required, and a full example.

## System design notes in the Syllabus

Syllabus chapters now hold: *System Design* (latency vs throughput vs bandwidth in a 3-column table, the cheatsheet image and its 8 sections in 3 columns), *Insights* (10 algorithms inside system-design boxes), *Challenges* (8 hidden problems, post link and image). Docs can embed local images with `![caption](/docs/file.png)` (files in `public/docs/`); tables accept `<br>` for line breaks inside cells.
- **Embeds**: `::linkedin urn:li:share:<id> <height> "title"` on its own line embeds a LinkedIn post (only LinkedIn embed URLs are possible). Used in Syllabus › Insights, Syllabus › System Design and Research › Apple AirTag case study.
- **System design folder** (`docs/system-design/`): its own menu group with three embedded LinkedIn posts.

## HTML & CSS interview page

Added `docs/interview/13-html-css.md` (Interview prep). Code blocks are captioned `index.html` / `styles.css`, keep exact indentation, and HTML/XML/SVG now get syntax colouring in `lib/docs/highlight.ts`.

## Search engine system design

Added section 3 "Pacewise Search Engine" to `docs/syllabus/06-system-design.md` with five SVG diagrams in `public/docs/search-*.svg`, capacity estimates, ingestion for docs/PDFs/images (OCR), tenant-routed index, query flow, ranking and failure modes.

## Cleanup

Insights and Challenges are cleared (placeholders), Syllabus "System Design 1" removed, and the three Case studies posts plus the other saved LinkedIn posts now live on one page, `docs/system-design/social-media.md`.
