# Speed Reading Trainer

A frontend-only Next.js (App Router) app for practicing English reading speed,
comprehension, and focus: bottom-to-top auto-scroll tuned to a target WPM, a
comprehension quiz generated from JSON, a GitHub-style contribution
calendar, a full pause/break tracking experience, and session analytics —
all client-side, persisted to `localStorage`.

> **Never compiled in this sandbox.** The environment this project was built
> in has no network access, so nothing here has been run through
> `npm install`, `next build`, or the TypeScript compiler. Every change is
> written and reviewed by hand — including a repo-wide brace/paren balance
> check and an import-resolution check after every edit — but treat this as
> a very thorough draft: run `npm install && npm run dev` locally and fix
> whatever the compiler flags. See **Known limitations** at the bottom.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Add your own story by dropping a new JSON file in `data/` — see
**Story JSON architecture** below for the schema.

**Per-user sessions & OOP design:** every signed-in user gets their own isolated
session (history, calendar/streaks, pace + efficiency graphs, bookmarks, uploads,
search history, backend tokens). Which OOP principles and patterns are used, why,
and exactly where is documented in [`docs/OOP_ARCHITECTURE.md`](docs/OOP_ARCHITECTURE.md).
Run the isolation tests with `npm run test:session`.

---

## Architecture at a glance

```
app/                        → routes = phases (dashboard → reader → questions → results)
contexts/                    → one Context+Reducer store shared by all phases
hooks/                       → engine/behavior logic extracted out of components
components/<Feature>/        → one component per feature, presentational only
components/Navigation/       → global TopNav + ProfileMenu (sticky, theme-aware, glass)
components/BreakTimer/       → floating pause card + live WPM-reduction hint
lib/                         → pure functions (math, storage, story loading) — no React
types/                       → shared TypeScript contracts
```

**The guiding rule, unchanged since the first line of code:** components
render, hooks orchestrate, lib computes. Nothing in `components/` owns a
timer, a `requestAnimationFrame` loop, or a `localStorage` call directly —
every one of those lives in `hooks/` or `lib/`, which is what keeps
components cheap to re-render, easy to test in isolation, and safe to
restyle without touching behavior.

---

## Design patterns used, mapped to the problem each one solves

### Finite-state machine via `useReducer` + Context — *the reading flow itself*
`contexts/ReadingContext.tsx`. The flow (`dashboard → reading → completed →
questions → results`) has many interdependent fields — phase, speed, font
settings, quiz answers, break stats, settings-panel visibility — that
several unrelated components need to read *and* mutate. A reducer makes
every transition an explicit, named action instead of scattered `useState`
calls and prop-drilling across four route segments, and it's exactly why
the **Reset Reading blank-screen bug** was a one-line diagnosis: `RESTART`
set `phase: "dashboard"`, but the reader route only renders its
Reader/Controls/ProgressBar tree when `phase === "reading"` — restarting
matched no render branch at all. Fixed by keeping `phase: "reading"` and
setting `isPlaying: true` on restart, so the story is visible and
auto-scrolling again immediately.

*Tradeoff:* a full state library (Zustand/Redux) would be unnecessary
weight for an app this size — `useReducer` + a split `StateContext`/
`DispatchContext` (so dispatch-only consumers don't re-render on every
progress tick) gets the same guarantees with zero extra dependencies.

### Strategy-style pure functions — *all reading/break/progress math*
`lib/wpmCalculator.ts`. Every number in the app that isn't UI state —
scroll duration, effective WPM, reduction percentage, efficiency score,
duration formatting — is a plain, side-effect-free function with no React
import. The reading engine, the break tracker, the dashboard stats, and the
efficiency report all call into the *same* functions rather than each
computing their own version, which is what guarantees a number never
disagrees with itself between two parts of the UI.

### rAF + CSS `transform`, progress-as-source-of-truth — *the accurate progress bug*
`hooks/useReadingEngine.ts`. The auto-scroll uses `requestAnimationFrame` +
`transform: translateY()`, never native `scrollTop` or a CSS `@keyframes`
animation — rAF lets Play/Pause/speed changes mutate velocity instantly
with no restart-jump, and `transform` is compositor-only so scrolling stays
smooth on long stories.

The **progress-accuracy bug** ("breaks after changing content width") was a
direction problem: the old engine accumulated scrolled distance in
*pixels* and derived the displayed percentage as `pixels / trackHeight`.
Content width, font size, line height, and letter spacing all reflow the
track and change `scrollHeight` — so a pixel offset calibrated against the
*old* height suddenly meant a different, visibly-jumping percentage against
the *new* one. The fix inverts the dependency: **progress (0..1) is now the
authoritative value**, advanced every frame by `dt / durationSeconds`,
completely independent of content geometry. The pixel transform is
*derived* fresh every frame as `progress × currentTrackHeight`, and a
`ResizeObserver` on the track re-derives that transform immediately on any
reflow (content width, font size, line height, letter spacing, or a window
resize) so the scroll position visually catches up without waiting for the
next tick. Consequence: the displayed percentage can no longer glitch from
a reflow, because it was never computed from the geometry that reflows in
the first place.

### Repository pattern — *all persistence, one aggregator*
`lib/storage.ts`. Every `localStorage` read/write goes through this one
module — streaks, bookmarks, history, and a `DailyActivity` row per
calendar day (minutes, sessions, stories completed, WPM samples, break
time, effective-WPM samples, reduction-percent samples). `getLifetimeStats()`
is the single aggregator both the Dashboard's stats block and the
contribution calendar's header call — **accurate dashboard statistics**
and the calendar's own totals are guaranteed to agree because they're
literally the same function call, not two independently-written
aggregations that could drift apart.

### Design-token theming — *dynamic, app-wide theme support*
`app/globals.css` defines `--canvas`, `--canvas-raised`, `--ink`,
`--ink-muted`, `--ink-faint`, `--overlay`, and `--shadow-color` as CSS
custom properties under `:root[data-theme="dark|light|sepia"]`.
`tailwind.config.ts` points its color tokens at those variables via
`rgb(var(--x) / <alpha-value>)`, so ordinary Tailwind opacity modifiers
(`border-overlay/10`, `bg-canvas/80`) keep working. `components/
ThemeSync.tsx` is the single place that writes `data-theme` onto `<html>`,
driven by `fonts.brightness` in the reducer (it already had exactly the
three values the theme picker exposes, so it doubles as the theme rather
than adding a second, parallel setting). Because every component uses
`bg-canvas`/`text-ink`/`border-overlay/*` instead of hex values, flipping
`data-theme` re-themes the navbar, cards, buttons, sliders, charts, and
shadows in one motion. Recharts' grid/axis/tooltip colors and the
Speedometer's track color were both later found still hardcoded to
dark-theme hex values and switched to the same `rgb(var(--x))` tokens —
noted here because "no component keeps old colors" is an easy thing to
almost achieve and miss two components.

### Facade pattern — *scalable, validated JSON story architecture*
`lib/stories.ts`. `validateStoryShape()` structurally checks a parsed JSON
object and returns human-readable issues; `normalizeStory()` fills in
whichever field pair (`level`/`difficulty`, `estimatedReadingTime`/
`estimatedWPM`) is missing from whichever pair is present; `loadStory()`
composes both and throws a `StoryValidationError` on malformed content
instead of producing a confusing blank reading screen. `types/index.ts`'s
`StoryData` gained `id`, `description`, `tags`, `difficulty`, and
`estimatedWPM` as **optional** fields alongside the originals — old story
files and the brief's newer example shape both validate and normalize to
the same internal type, so adding a story is a JSON file, not a code
change. `data/stories.json` demonstrates both field-pairs coexisting;
`data/story-002-example.json` uses only the new minimal schema, to prove
the loader normalizes it correctly with nothing legacy present.

### Presentational components, hooks own behavior — *everywhere*
`Reader`, `Speedometer`, `Controls`, `QuestionCard`, `ResultCard`,
`BreakTimer`, `ReadingEfficiencyReport`, `ContributionHeatmap` all take
props and render — no internal timers, no storage calls. All timing/
accumulation logic lives in `hooks/useReadingEngine.ts`,
`hooks/useBreakTracker.ts`, and the pure functions in `lib/`. This is what
let the pause-experience feature (floating timer, live reduction hint,
final report, dashboard trend integration) be added without touching the
reading engine at all — it's a second consumer of the same `isPlaying`
boolean the engine already threads through the reducer.

---

## Feature walkthrough by problem area

### Reading engine & progress accuracy
- True WPM-driven auto-scroll: `words ÷ selected WPM → duration → progress
  integrated over real time → pixel offset derived from live geometry`
  (see the engine section above for why this order matters).
- Progress, words remaining, and time remaining recalculate immediately and
  without glitching when content width, font size, line height, or letter
  spacing changes, via the `ResizeObserver`-driven re-derivation.
- Restart resets progress/timer/scroll/WPM-samples and keeps the reader
  visible and playing immediately (the blank-screen bug is fixed at the
  reducer level, not papered over in a component).

### Reader layout & readability
- Content track's `max-width` is `min(contentWidth ch, 100vw − gutter)` —
  mathematically incapable of running under the docked sidebar, regardless
  of slider position or viewport size — plus a hard 75ch ceiling (matching
  the Controls slider's own max) so the reading column never exceeds what
  Apple Books/Medium/Kindle-style apps consider a comfortable line length.
- The sidebar (Speedometer + BreakTimer) only reserves space at the `lg`
  breakpoint; below that the reading column reclaims full width instead of
  leaving a dead gutter on phones/tablets.

### Speedometer
- Default size trimmed from 220px to 152px, with stroke width now
  proportional to size (`size / 20`) instead of a fixed 10px, so it reads
  as a secondary glance-able instrument rather than competing with the
  story for attention. The reserved sidebar gutter shrank alongside it
  (`260px → 220px`), giving the reading column more room without
  reopening the overlap bug the gutter exists to prevent.

### Sticky paragraph progress
- `ProgressBar` now shares the exact glass treatment as `TopNav` —
  `backdrop-blur-xl`, translucent `bg-canvas`, hairline `border-overlay`,
  the same `shadow-themed` token — and docks directly beneath it (`top-14`)
  so the two read as one continuous navigation system rather than two
  independently-styled bars.

### Navigation bar
- `TopNav`: sticky glass panel with app mark, current story title, a live
  progress/WPM readout (only while reading, so it never shows stale
  numbers on the dashboard), theme-cycle, fullscreen, and settings buttons.
- `ProfileMenu` (new, `components/Navigation/ProfileMenu.tsx`): a circular
  avatar button opening a glass dropdown with Dashboard / Reading History /
  Analytics / Settings, closing on outside click, Escape, or item
  selection. "Reading History" and "Analytics" both currently route to
  `/results` — the one page that already renders session history and the
  analytics charts — since a dedicated split into `/history` and
  `/analytics` routes wasn't in scope; noted as a routing-only follow-up
  in Known limitations.

### Dashboard statistics
- The dashboard's first statistics container now shows **Effective WPM,
  Selected WPM, Reading Efficiency, Average Break Time, Total Break Time,
  Reading Time, Stories Completed, and Current Streak** — all pulled from
  `storage.getLifetimeStats()`, i.e. real recorded sessions, not story
  metadata. The story's own info (paragraphs/questions/level/estimated
  time) still displays, now clearly labeled "About this story" and moved
  to a second, secondary position — nothing was removed, just correctly
  re-labeled and reordered under an accurate first block.

### Contribution graph — GitHub-style, alignment bug fixed
`components/Analytics/ContributionHeatmap.tsx` — a single continuous
strip (most recent week on the right), matching GitHub's own visual
layout. An earlier revision briefly rebuilt this as one card per calendar
month; that was reverted — the continuous-strip version was already
correct except for one bug, and a full rebuild wasn't warranted for a
one-bug fix. (A later pass, described further down, did end up changing
how the strip's columns are built — see "Month-boundary rework" — but
kept the same single-strip visual this section describes.)

**The bug:** month labels were positioned with
`style={{ left: index * 13 }}` — a manually-guessed pixel pitch that
didn't quite match the day grid's real per-column width (`11px cell +
3px gap = 14px`, not 13). A 1px-per-column error compounds across 53
columns: small on the left, largest on the right — which is exactly why
it read as "the last month's alignment is off" even though every column
was drifting a little.

**The fix:** removes pixel-guessing entirely. The month-label row and the
day-grid row are now laid out with the *identical* CSS Grid
(`grid-template-columns: repeat(53, 11px)` + matching gap), so column *i*
in one is column *i* in the other by construction — the browser's grid
engine guarantees the alignment instead of arithmetic trying to
approximate it. A second, smaller bug was fixed alongside it: month
detection previously only checked each column's *first* day (Sunday) to
decide its label, so a month starting mid-week could get attributed to
the wrong column or dropped entirely near the current week. Detection now
scans every day in a column in order and labels the column where each
month's days first appear.

Everything else about the graph is unchanged from the working version:
accurate per-day tracking via `storiesCompletedCount`, the requested
tooltip content (date, attempt count, ✅ story count, reading time,
effective WPM, break time), today's ring highlight, disabled future-day
cells, and the stats header (Current Streak, Longest Streak, Total Active
Days, Total Reading Time) from the same `getLifetimeStats()` the
Dashboard uses.

Two more passes refined it against direct visual references. First, a
reference screenshot temporarily grew the cells to 18px with heavier
rounding and simplified the intensity scale from six bands to four (No
activity/Low/Medium/High) — the four-level scale stuck, but a later
reference (the original compact code) asked to revert the sizing back to
the tight 11px/3px-gap GitHub proportions, which is the version shipped
now; the CSS-Grid alignment fix underneath is unaffected by cell size —
`CELL_PX`/`GAP_PX` are the only two numbers that ever need to change
together. Second, hovering a cell used to rely on the native `title`
attribute, which carries the browser's own ~0.5–1.5s hover delay before
the tooltip appears — unfixable from CSS/HTML, since that delay lives in
the browser's UA styling, not the page. It's now a custom tooltip
(`hovered` state set on `onMouseEnter`/`onFocus`, cleared on
`onMouseLeave`/`onBlur`, positioned with `position: fixed` off the
hovered cell's `getBoundingClientRect()` so it escapes the calendar's
horizontal-scroll clipping) that appears the instant the pointer lands,
with the same content as before rendered as real DOM instead of a
tooltip string, plus an **Attempts** line (`entry.sessions`, already
tracked per day) added along the way.

**Month-boundary rework.** The continuous strip described above still
built its 53 columns as one uninterrupted day-by-day stream — a week
column could (correctly, by real GitHub's own rules) contain the last
few days of one month and the first few days of the next, whenever a
month boundary fell mid-week. On explicit request to guarantee a month
*never* appears to continue beneath the previous one, the week-building
was rewritten to work **month by month** instead: each of the last
`MONTHS_TO_SHOW` (12) months generates its own run of columns — leading
`null` cells padding day 1 out to its real weekday, the days themselves,
then trailing `null` cells padding the final week to a full 7 — and
those per-month column runs are concatenated left to right,
oldest-to-newest. A month's last real day and the next month's first
real day can now never land in the same column; the next month always
starts at the top of a fresh column. The `weeks` array itself is still
one flat, uninterrupted list (no per-month cards, no gaps between
months) so it reads as the same single continuous strip as before — only
where the column *breaks* fall changed, not the overall look. `GridCell`
(`DayCell | null`) makes the distinction explicit in the type system: a
`null` cell is guaranteed-structural padding and renders as true empty
space (no color, no border, no interaction), which is a different
visual state from a real future date (still rendered with the dashed
"not yet happened" border, as before) — the two were easy to conflate
before this cell type existed. Days-in-month and the leading-blank count
both come from `Date` arithmetic (`new Date(year, month + 1, 0)
.getDate()`, `new Date(year, month, 1).getDay()`) rather than any
hardcoded table, so 28/29/30/31-day months and leap years all fall out
correctly with no special-casing — verified against `calendar
.monthrange()` across a full 12-month span including a leap February
with no column ever spanning two months. `gridTemplateColumns` now
reads `weeks.length` instead of a fixed constant, since the exact column
count varies slightly month to month depending on how each month's
weekday alignment falls (62 columns for a representative 12-month span,
close to the old fixed 53 — the horizontal scroll behavior is
unaffected).

### Daily pace fluctuation — a second, Codeforces-style tracking chart
`components/Analytics/DailyTrendChart.tsx`, rendered directly below the
calendar. Where the calendar answers "which days was I active," this
answers "how is my pace trending session to session" — modeled on a
competitive-programming contest rating graph rather than the calendar's
GitHub-style grid:
- **Only days with an actual attempt become a point** — an inactive day
  isn't plotted as a dip to zero, the same way a rating graph has no
  point for a contest you didn't enter — connected in chronological
  order by a line.
- **Each dot is colored green or red** depending on whether that day's
  effective WPM held/improved or dropped versus the *previous plotted
  day* (`#7FC97F` / `#E05B5B`), giving the same "up good, down bad" read
  at a glance as a rating graph's move indicators. This is computed as a
  closure over the already-sorted `points` array inside the component
  (`renderDot`), not via a prop Recharts doesn't provide by default —
  worth calling out because the first draft of this function reached for
  a nonexistent `props.points` and had to be corrected.
- A dashed **average reference line** and a hover tooltip (date, effective
  WPM, attempts, reading time) — the same "attempts" number the calendar
  tooltip shows, from the same `DailyActivity.sessions` field.
- Below two data points, shows an explanatory empty state instead of an
  unreadable single-dot chart.

### Production-level pause experience
- `hooks/useBreakTracker.ts` is the single source of truth for every pause
  number: it watches `isPlaying`, opens a break session on the
  true→false edge, ticks a 1-second interval only while paused (a plain
  interval, not rAF — a pause timer only needs whole-second precision),
  and folds the break into cumulative `sessionBreakMs`/`breakCount`/
  `longestBreakMs` on the false→true edge — **never resetting those
  totals**, so a second pause continues accumulating rather than starting
  over. A second guard finalizes an in-flight break if the session ends
  entirely while still paused (e.g. hitting Skip mid-break).
- `components/BreakTimer/BreakTimer.tsx`: a fade+scale spring-animated
  glass card (Reading Paused / live `mm:ss` clock / Total break today),
  docked in the same reserved sidebar column as the Speedometer on desktop
  (physically cannot overlap story text — that column is empty of text by
  construction) and centered as a lightweight modal on mobile.
- **Live WPM-reduction hint**: shown once reduction crosses ~1%, amber
  colored, with a slow "sinking" `TrendingDown` icon and a spring-animated
  percentage (`components/ui/animated-number.tsx`) that ticks rather than
  snaps. Disappears the instant `isPaused` goes false — a render condition
  on live state, not a flag to remember to clear — while the cumulative
  stats it read from are untouched.
- **Reduction math** (`lib/wpmCalculator.ts`): `effectiveWpm(wordsCovered,
  elapsedMs)`, `wpmReductionPercent` (clamped 0–100, 1 decimal),
  `readingEfficiencyScore`, `readingEfficiencySummary`. The live hint feeds
  `wordCount × progress` (frozen while paused — scroll doesn't move) over
  wall-clock elapsed time (*not* frozen), so a growing denominator over a
  frozen numerator is what makes the percentage climb in real time on a
  break — no special-cased "pause math," the same formula evaluated
  continuously.
- **Final report** (`ReadingEfficiencyReport.tsx`, on the Results page):
  nine stat cards (Selected/Effective WPM, WPM reduced by, Total/Average/
  Longest break, Number of breaks, Active reading time, Total session
  time) plus an efficiency score badge and a qualitative summary sentence.
- **Dashboard/analytics integration**: `storage.recordSession()` — the
  same write path the calendar reads — additionally accepts `breakMs`,
  `breakCount`, `effectiveWpm`, and `reductionPercent`, merged into the
  same per-day row. `EfficiencyTrends.tsx` derives daily break time,
  average break duration, daily effective WPM, a WPM-reduction trend
  (earliest third of active days vs. most recent third — a simple,
  explainable improving/declining/stable signal), and a documented
  heuristic "Reading Consistency" score (`100 − average reduction%`, not a
  variance-based statistic — the schema stores running sums, not raw
  per-session arrays, so a real variance calculation isn't available
  without a schema change; stated here rather than quietly approximated).

### Footer
`components/Footer/Footer.tsx`, mounted globally in `app/layout.tsx`
alongside `TopNav`. Same "icon + label + keyword breakdown" layout as the
reference design it was integrated from, but the background is the
`bg-canvas-raised` theme token instead of a fixed gradient image — it
repaints for dark/light/sepia through the same CSS custom properties
every other surface uses (see the Design-token theming section above;
"eyecomfort mode" in the request is this app's sepia theme, a warm tone
specifically meant to reduce eye strain during reading, so no new theme
was needed). The icon badge reuses TopNav's own `bg-ink text-canvas
rounded-lg` logo-mark treatment for visual consistency rather than
introducing a new icon style.

Hidden on `/questions` (the quiz route) via `usePathname()`, visible on
every other route. One caveat worth being explicit about: on `/reader`,
the Reader component is `position: fixed; inset: 0` with an opaque
background — a deliberate full-bleed, distraction-free layout (see the
Reader layout & readability section). The footer is still mounted in the
DOM there, but visually sits *behind* that fixed layer, the same way any
normal-flow content behind a fixed full-screen element would. Making it
actually visible during active reading would mean punching a footer-sized
hole in the one screen this app goes out of its way to keep distraction-
free, so this was left as-is rather than silently reworking that layout;
flagging it here instead of leaving it to be discovered.

### Loading states
Two supplied `styled-components` loaders — a 12-blade fading spinner and a
rotating sun-icon with a "Loading..." label — are integrated verbatim
(`components/ui/loaders/SpinnerLoader.tsx`,
`components/ui/loaders/SunLoader.tsx`; only a `"use client"` directive was
added, since Next's App Router requires it for any component using
React context, which `styled-components` does internally — the loaders'
own markup, styles, and animations are untouched). The blade spinner
replaces the `animate-pulse` skeleton in `ContributionHeatmap` and
`DailyTrendChart` while their first `storage` read resolves; the sun-icon
loader backs a new shared `components/ui/PageLoader.tsx`, used by all
four routes (`/`, `/reader`, `/questions`, `/results`) in place of a bare
`return null` for the instant before `state.story` is populated — a
loading indicator instead of a blank flash. `next.config.js` gained
`compiler.styledComponents: true`, Next's built-in SWC transform for
correct server/client class-name hydration with `styled-components` — a
build-config need, not a change to either loader.

### Chart Y-axis clipping fix
All three Recharts line charts on the Results/Analytics page (the two
history charts in `Analytics.tsx`, plus `DailyTrendChart`) had their
Y-axis labels clipped or hidden. Two distinct causes:

1. **`DailyTrendChart` had a literal `margin={{ left: -12, ... }}`** on
   its `<LineChart>` — a negative left margin drags the entire plot area,
   Y-axis included, 12px to the *left* of the SVG canvas, which pushes
   the axis labels partly or fully off the visible area. Changed to a
   normal positive `left: 4`, plus an explicit `YAxis width={40}` so the
   label column always reserves real room regardless of the widest tick
   value at any given time.
2. **All three charts sit inside `<Card>` elements that are themselves
   CSS Grid items** (`Analytics.tsx`'s two charts are direct children of
   a `grid sm:grid-cols-2`). Grid items default to `min-width: auto`,
   which can stop a shrinking flex/grid child from ever getting narrower
   than its content's "natural" width — a well-known cause of Recharts'
   `ResponsiveContainer` miscalculating available width and clipping
   content on narrower viewports. Fixed by adding `min-w-0` to each
   chart-holding `Card`, which is the standard override for this
   specific CSS Grid behavior and doesn't affect anything else about the
   card's sizing.

All three charts also gained slightly more generous, explicit
`margin`/`YAxis width`/`tickMargin` values as a second layer of defense
(so a future tick-label format with more digits doesn't reopen the same
clipping), matching X-axis positioning and all existing tooltip/
animation/data behavior are untouched — only the margin numbers and the
`min-w-0` class changed.

---

### Navbar search, multi-story library, and "add your own story"

**Problem:** the app only ever loaded one hardcoded story
(`data/stories.json`, wired directly into `app/page.tsx`). There was no
way to search, switch between stories, or add your own without editing
code.

**What changed, and why it's shaped this way:**

1. **`lib/storyLibrary.ts` — a Facade over "every story the app knows
   about."** It combines the JSON files bundled under `/data` (still
   added with zero code changes, per the existing `lib/stories.ts`
   contract) with whatever the user has added at runtime, and exposes
   exactly three entry points: `getAllStories()`, `addCustomStory(raw)`,
   `searchStories(query)`. No other module reads the `/data` JSON files
   or custom-story storage directly — the same single-entry-point
   discipline `lib/storage.ts` already uses for `localStorage`.
2. **`lib/storage.ts` gained `getCustomStories`/`saveCustomStory`/
   `removeCustomStory` and `getSearchHistory`/`addSearchHistory`**,
   following the Repository pattern already established there (every
   read defends against SSR/corrupt JSON; every write is best-effort and
   never throws).
3. **`components/Search/SearchBar.tsx`** — the uploaded pill-shaped
   search input (magnifying-glass button overlapping the input's right
   edge, `#f4f2f2` background, `30px` radius) is kept as a verbatim
   `styled-components` block, the same convention already used for the
   two loader components, so its visual design is untouched. All new
   *behavior* — a Google-style live suggestions dropdown, recent search
   history, keyboard navigation (↑/↓/Enter/Esc), and an "Add your own
   story" entry — lives in a plain-React/Tailwind wrapper around it,
   themed with the app's existing design tokens so the dropdown matches
   `ProfileMenu`'s glassmorphic styling instead of inventing a new look.
4. **`components/Search/AddStoryModal.tsx`** — lets a user add a story
   without touching any file: a guided form (title, description,
   difficulty, target WPM, paragraphs, optional comprehension questions)
   or a raw-JSON paste for the app's native schema. Both paths funnel
   through the same `addCustomStory()` → `lib/stories.ts`'s existing
   `loadStory()` validator, so a malformed custom story fails with the
   same structured error list the app already produces for a broken
   hand-edited JSON file, rather than a second, divergent validation path.
5. **`TopNav.tsx`** — the search bar occupies the navbar's center slot
   only when a session isn't actively reading; during reading, that slot
   still shows the live progress bar + WPM exactly as before. Selecting a
   story (from search results, history, or just-added) dispatches the
   existing `LOAD_STORY` reducer action and navigates to the dashboard,
   so starting a different story reuses the same state-reset logic the
   app already relies on — no new reducer case was needed.

---

### AI-chat-style search input with voice, per-question timing, and test history

**1. Search input swapped for the uploaded voice/file/text design.** The
pill input was replaced with the uploaded `styled-components` component
(text field that widens on focus, a mic button that expands into a full
voice panel, a row of upload icons) kept verbatim for its CSS — same
reasoning as the pill before it: the sibling-combinator selectors
(`.input-text:valid ~ .label-text`, `.input-voice:checked ~ ...`) only
work if the DOM order from the original is preserved, so the React
wrapper only adds `value`/`checked`/`onChange` to make the existing
markup controlled rather than rewriting its structure. Three real
behaviors were wired behind it, replacing what the design only implied:
- **Voice search** uses the browser's `SpeechRecognition` API
  (`webkitSpeechRecognition` fallback). Checking the mic starts
  listening; interim transcripts stream into the search box live (shown
  in the expanded panel's text), and a final transcript runs the same
  search path a typed query would, then collapses the panel automatically.
  Unsupported browsers leave the button inert rather than erroring.
- **The three upload icons** each map to a real way to add a story: a
  file-picker that reads a `.json` file straight off disk and validates
  it through the existing `loadStory()`, the guided form, and the raw-JSON
  paste tab — all three ultimately calling the same `addCustomStory()`.
- **The "+" button** (visible once text is typed) opens the guided form
  directly, for adding a story mid-search without losing the query.

**2. Navbar height vs. expandable content.** The voice panel expands to
a 300×300 box, the suggestions dropdown and the Add Story modal's
question list both grow with content — none of that can be capped to
the navbar's fixed `h-14`. These were already positioned
absolute/fixed (so a `h-14` ancestor doesn't constrain their rendered
size), but `overflow-visible` was made explicit on the navbar `<header>`
and its inner row rather than left as an implicit default, specifically
so a future change to that bar doesn't accidentally reintroduce clipping.

**3. Per-question quiz timing.** `QuestionAnswer.timeSpentMs` was already
being recorded for every question (`app/questions/page.tsx`'s
`commitAnswer`) — it just wasn't shown anywhere. `QuizResult` gained a
`totalTimeMs` field (the sum across all answers — "how long did the
whole test take"), and a new `QuestionTimingBreakdown` component on the
Results page lists every question with a time bar scaled to the
slowest question *in that attempt*, so a reader can see which question
cost them the most time, not just an average.

**4. Past test attempts on the dashboard.** `ReadingHistoryEntry` gained
optional quiz fields (`totalQuestions`, `correctAnswers`,
`quizTotalTimeMs`, `avgTimePerQuestionMs`), filled in once a quiz
finishes. Fixing this surfaced a latent bug in the existing history
code: `addHistoryEntry` always *prepends* a new row, so patching the
reading-completion placeholder (written with `accuracy: 0` before the
quiz even starts) with the real score was quietly leaving a stray
"0% accuracy" duplicate in history for every single quiz taken. Added
`storage.updateHistoryEntry(id, patch)` to patch in place instead, and
switched the results page to use it. `storage.getQuizAttempts()` /
`getQuizStats()` then give the dashboard's new "Past test attempts"
card a clean, de-duplicated list plus an average accuracy/time — the
same single-aggregator convention `getLifetimeStats()` already
established, so the list and the average it's computed from can't drift
apart.

---

### Search moved out of the navbar onto a dedicated Google-style landing page

**Problem:** the search bar lived in the navbar's center slot, cramped
into a 56px-tall bar — not a great home for something meant to be the
app's primary way to pick a story, and not what "search" usually looks
like as a first-run experience (Google, not a toolbar).

**What changed:**

1. **`TopNav.tsx`** no longer renders `SearchBar` at all; its center slot
   is empty outside an active reading session, same as before search
   existed.
2. **`components/Search/SearchLanding.tsx`** is new: a centered mark +
   tagline + the same `SearchBar`, filling `calc(100vh - 56px)` — the
   full viewport minus the sticky navbar's height — so the search
   experience itself genuinely gets the whole screen, the way Google's
   homepage does, without also hiding the navbar's theme/fullscreen/
   profile controls (those stay reachable, since unlike Google this app
   has per-session reading settings worth keeping one tap away).
3. **`app/page.tsx`** no longer force-loads `data/stories.json` on
   mount. The app's entry point is now: no story → `SearchLanding`;
   story chosen (via search, voice, browse, or "add your own") →
   `Dashboard`, unchanged. Selecting a story still goes through the same
   `LOAD_STORY` dispatch as before, so nothing downstream had to change.
4. **`Footer.tsx`** also hides on this landing view (`/` with no story
   loaded) for the same reason it already hides on `/questions` — a
   footer competing for space would undercut the point of a page that's
   supposed to be dedicated search space.
5. **Icon fixes in `SearchBar.tsx`:** the upload-row icons didn't read as
   what they did — one looked like a photo/camera icon while actually
   opening a file picker. Replaced with two unambiguous `lucide-react`
   icons: a file icon that opens the laptop's file picker (reads a
   `.json` story straight off disk), and a plus icon that opens the
   "add a new story" form. The redundant third icon was dropped — the
   JSON-paste option is still one tab away inside the Add Story modal.
6. **Browse-all-stories fallback:** focusing the search box with no
   query and no search history yet (true for every first-time visitor,
   since this is now the first thing they see) used to show an empty
   dropdown. It now falls back to a plain "Browse stories" list of
   everything in the library, so the landing page doesn't require
   already knowing a story's title to go anywhere.

### Voice overlay, hamburger menu, playlists, scroll-reveal feed, and pagination

**Problem:** a follow-up brief asked for a batch of behavior the app
didn't have yet — a full-screen voice search experience, a navbar search
box independent in size from the landing page's, scroll-revealed content
below the landing search box, save-to-playlist, a hamburger menu holding
playlists + search history (with per-item delete, clear-all, and re-run),
pagination, and the landing-page footer back — under one hard constraint:
don't change any existing visual design, only extend it.

**What changed:**

1. **`components/Search/VoiceSearchOverlay.tsx`** is new: checking the
   mic button no longer grows the old inline 300×300 panel — it opens
   this component instead, a true `100vw`×`100vh` experience. It's
   portal-rendered straight onto `document.body` rather than in place,
   because `TopNav`'s `backdrop-blur` is a CSS `filter`, and a `filter`
   on an ancestor creates a new containing block for `position: fixed`
   descendants in modern browsers — without the portal, an overlay
   triggered from the navbar's own search box would be clipped to the
   navbar's bounds instead of actually covering the viewport. The old
   inline-expand CSS/markup (`.ai`, `.c`, `.container`, `.glass`,
   `.text-voice`, and their keyframes) was dead code once the panel no
   longer grew in place, and was removed rather than left inert.
2. **`SearchBar.tsx` gained a `size` prop** (`"default"` | `"sm"`, 300px
   vs. 220px) — an inline `width` override on the existing styled
   container only, so the shared CSS block (and everything it still
   controls — the morph-on-focus behavior, the icon row) is untouched.
   The landing page keeps the original 300px box; `TopNav` now renders
   the 220px one. A `maxWidth: calc(100vw - 48px)` was added alongside it
   so neither size can force horizontal overflow on very narrow phones.
   The suggestions dropdown's hardcoded `w-[300px]` was also removed
   (kept as `min-w-[260px]` with `inset-x-0`) — CSS gives an explicit
   `width` priority over `inset-x-0`, so the fixed width would have kept
   the dropdown pinned to the old 300px box's size even under the new
   220px one.
3. **Duplicate-id fix in `SearchBar.tsx`:** its voice/text/files
   `<label htmlFor>`/`id` pairs were hardcoded strings. That was fine
   when only one `SearchBar` ever existed on a page; now the landing
   page and the navbar each render their own at the same time, and a
   `<label htmlFor>` only ever binds to the *first* matching `id` in the
   document — so the second instance's buttons would have silently
   driven the first instance's input. Fixed with `useId()`, giving each
   mounted `SearchBar` its own id namespace without touching any
   `className` (what the CSS actually targets).
4. **`components/Navigation/HamburgerMenu.tsx`** is new — there was no
   hamburger menu in the app before this. A left-side drawer (portal-
   rendered onto `document.body` for the same containing-block reason as
   the voice overlay), triggered from a new icon button at the leftmost
   edge of `TopNav`'s existing logo cluster. Holds two sections:
   **Playlists** (create, delete, expand to see/remove saved stories,
   open a story) and **Search history** (click to re-run, per-item
   delete, "Clear all" behind an inline Confirm/Cancel step rather than a
   browser `confirm()`, to match the app's existing in-UI-confirmation
   style elsewhere).
5. **Playlists and reactions added to the existing `lib/storage.ts`
   Repository**, not a new storage module: `getPlaylists`,
   `createPlaylist`, `deletePlaylist`, `addStoryToPlaylist` /
   `removeStoryFromPlaylist` (both dedup-safe — saving a story already in
   a playlist is a no-op, not a duplicate), and `getReactions` /
   `setReaction` for like/dislike (exclusive, like YouTube's pair, not
   independently toggleable). `removeSearchHistoryItem` was added next to
   the existing `addSearchHistory`/`clearSearchHistory` for the
   hamburger menu's per-item delete, and the history cap was raised from
   10 to 30 entries.
6. **`components/Search/StoryCard.tsx`, `SaveToPlaylistPopover.tsx`, and
   `ContentFeed.tsx`** are new. `StoryCard` is built entirely from
   existing primitives (`Card`, `Button`, the same canvas/ink/overlay
   design tokens everything else uses) and shows title, description,
   author (falls back to "Speed Reader" when a story doesn't set one —
   see the new optional `StoryData.author` field), level, estimated
   reading time, Save/Like/Dislike, and a Read action. `ContentFeed`
   renders a grid of these below the landing page's search box, sourced
   from the same `getAllStories()` facade every other search surface
   already reads from. Pagination is infinite-scroll (an
   `IntersectionObserver` watching a sentinel div) but still pages
   internally in fixed `PAGE_SIZE` (6) slices rather than rendering the
   whole library at once — swapping that slice for a real paginated API
   call later is a one-line change, not a rewrite. Cards fade in with a
   small `whileInView` animation, once each, rather than animating on
   every re-render.
7. **`SearchLanding.tsx`** keeps its original centered search block
   (same size, same copy, same `min-h-[calc(100vh-56px)]` centering)
   completely unchanged, and appends `ContentFeed` directly after it —
   additive, not a redesign of the landing page.
8. **`Footer.tsx`'s landing-page-hiding condition was reverted.** It
   hid itself on `/` whenever no story was loaded, back when that page
   was nothing but a centered search box with no content below it to
   scroll past. Now that the landing page has `ContentFeed` under the
   search box, the footer renders after it again, the same way it
   already renders after the Dashboard's content on every other route.
9. **`components/Search/MobileSearchSheet.tsx`** is new: at phone
   widths there isn't 220px of spare row left in `TopNav` once the
   hamburger, logo, and the theme/fullscreen/settings/profile icon
   cluster are laid out, so the inline navbar `SearchBar` hides below
   the `sm` breakpoint rather than overflowing the bar. This gives
   phones a dedicated search icon button instead, which opens the exact
   same `SearchBar` component (not a second implementation of it)
   full-screen, the same portal/overlay pattern as voice search.
10. **`globals.css`** gained `scroll-behavior: smooth` (with a
    `prefers-reduced-motion` override back to `auto`, inside the
    existing reduced-motion media block) for the landing page's
    scroll-reveal feel, per the brief's "smooth, not jumpy" requirement.

### Social layer: dev accounts, follow/unfollow, share, notifications, comments

**Problem:** a follow-up brief asked for a whole social layer — accounts,
follow/unfollow, sharing content to specific people, a notification system,
comments, and interest-ranked feeds — under one hard constraint: **no
database or real backend yet.** Every relationship (share, notification,
comment, reaction, save, playlist membership, follow) had to live in the
codebase itself, in one typed, swappable module, with stable IDs
throughout, while the existing UI/branding/components stayed untouched and
only extended. This section is the 20-point report the brief asked for.

**1. Files created**

- `lib/devData/types.ts` — every temporary data-model type (see point 4).
- `lib/devData/seedUsers.ts` — the 20 seeded `DevUser` records.
- `lib/devData/contentMeta.ts` — deterministic content→author/topic mapping.
- `lib/devData/store.ts` — the `DevDataStore` class + its singleton export.
- `lib/devData/useDevStore.ts` — `useDevStoreVersion()` / `useCurrentUser()` hooks.
- `lib/devData/index.ts` — barrel re-export of the above.
- `lib/toastBus.ts` + `components/ui/ToastHost.tsx` — lightweight toast
  feedback for share/comment/follow actions (separate from the dev store
  since toasts are ephemeral UI state, not persisted relationship data).
- `components/Auth/DevLoginGate.tsx` — the minimal dev login screen.
- `components/Content/ShareModal.tsx` — share-to-recipient popover.
- `components/Content/CommentPanel.tsx` — view/write comments popover.
- `components/Content/ContentActions.tsx` — the single shared Like / Dislike
  / Save / Playlist / Share / Comment button row.
- `components/Navigation/NotificationBell.tsx` — navbar notification icon
  + dropdown + unread badge.
- `components/Profile/UserProfile.tsx` + `app/profile/[userId]/page.tsx` —
  a user's profile page (follow/unfollow, their content grid).

**2. Files modified**

`app/layout.tsx` (mounts `DevLoginGate` + `ToastHost`), `tailwind.config.ts`
(named z-index scale), `components/Navigation/TopNav.tsx` (notification
bell, navbar-search landing-page fix, clickable logo/`goHome`),
`components/Navigation/ProfileMenu.tsx` ("Signed in as…", View profile,
Log out (dev)), `components/Navigation/HamburgerMenu.tsx` (playlists
migrated to the dev store; z-index tokens), `components/Search/StoryCard.tsx`
(now renders `ContentActions`; author byline links to `/profile/[id]`),
`components/Search/ContentFeed.tsx` (interest-ranked ordering),
`components/Search/SaveToPlaylistPopover.tsx` (migrated to the dev store;
right-anchored; Escape-to-close), `components/Search/AddStoryModal.tsx`
(portal-rendered — containing-block fix), `components/Search/VoiceSearchOverlay.tsx`
/ `MobileSearchSheet.tsx` (z-index tokens), `components/Dashboard/Dashboard.tsx`
(author byline + follow button + `ContentActions` above the stats grid),
`contexts/ReadingContext.tsx` (new `CLEAR_STORY` action), `lib/storage.ts`
(old localStorage playlist/reaction code removed — superseded by the dev
store), `types/index.ts` (removed the now-unused `Playlist` type; `Reaction`
kept, reused by `DevReaction`).

**3. APIs / routes / server actions added**

None beyond one new page route, `/profile/[userId]`. There is still no
server, no API route handler, and no database anywhere in the project —
every "backend" operation (share, notify, comment, react, save, follow) is
a synchronous method call into the in-memory `devDataStore` singleton
described below.

**4. Temporary data models added** (`lib/devData/types.ts`)

`DevUser`, `DevShare`, `DevNotification`, `DevComment`, `DevReaction`,
`DevSave`, `DevPlaylistRelationship`, plus two additive, documented
adaptations the brief's shapes implied but didn't spell out: `DevPlaylist`
(the playlist entity itself — the brief only specified the *relationship*
record) and `DevFollow` (the brief's prose explicitly asks for follow/
unfollow but its type list didn't include one). Every record uses a
stable, prefixed, never-array-index ID (`user-001`, `story-100`,
`share-<n>`, `notif-<n>`, `comment-<n>`, etc.).

**5. The centralized persistence mechanism**

`lib/devData/store.ts` exports one singleton, `devDataStore`, holding every
relationship in private arrays inside a plain class, `DevDataStore`. It is
explicitly documented at the top of the file as **temporary, development-
only storage** — not a database, not a server. It exposes typed CRUD
shaped like a future API client (`listShares`, `createShare`,
`deleteShare`, `listNotifications`, `markNotificationRead`,
`deleteNotification`, `listComments`, `createComment`, `deleteComment`,
`getReaction`, `setReaction`, `reactionCounts`, `isSaved`, `toggleSave`,
`listPlaylists`, `createPlaylist`, `deletePlaylist`, `addToPlaylist`,
`removeFromPlaylist`, `playlistsContaining`, `isFollowing`, `toggleFollow`,
`followerCount`, `followingCount`, `login`, `logout`, `getCurrentUser`) so
that swapping in real network calls later means rewriting the *inside* of
these methods only — no UI component ever touches the underlying arrays
directly, and none of them ever touch `localStorage` directly either.
Every mutating method bumps an internal `version` counter; a
`subscribe`/`getVersion` pair feeds `useDevStoreVersion()` (built on
React's `useSyncExternalStore`), so every component reading the store
re-renders instantly when *any* other component mutates it, with no
prop-drilling and no duplicate local copies of the data.

**Durability, updated per a later round of feedback:** every mutation is
now also mirrored into this browser's `localStorage` (`persist()`,
called at the end of the same internal `touch()` every method already
called), and loaded back via an explicit `hydrate()` call fired once from
a small client-only effect in `DevLoginGate.tsx` — deliberately *not*
eagerly in the module's constructor, so the very first render (including
Next.js's server-rendered HTML, which has no access to the browser's
storage) always starts identical on server and client, avoiding a
hydration mismatch, and then updates a moment later with whatever was
saved. The practical effect: shares, notifications, comments, reactions,
saves, playlists, follows, and who's logged in now survive a real page
reload or reopening the tab on the same machine — "saved for real on this
laptop" — while the mechanism is still entirely frontend-only (no server,
no database, no sync between browsers/devices). See limitation #11 below
for exactly what this does and doesn't cover.

**6. The 20 development users**

All 20 live in `lib/devData/seedUsers.ts`, each with a stable ID, a unique
username, an `interests` array (used for feed ranking), and a demo
password generated by a small deterministic helper so every password is
unique, timed-looking, and visibly non-production
(easy, but each in a different format). Users `user-001`, `user-002`,
`user-003`, and `user-005` are the four the brief specifically requires as
available share-test recipients — all four are included.


**7. Credential handling & limitations**

`devDataStore.login(userId, password)` does a plaintext string comparison
against the table above — there is no hashing, no session token, no
cookie, and no server round-trip. This is explicitly dev/demo-only and is
called out both in the module's header comment and here: **replace this
entire mechanism before production** (e.g. with a real auth provider and
hashed credentials server-side). The login screen (`DevLoginGate`) is a
new, minimal, unstyled-beyond-existing-tokens gate — it does not redesign
or replace any existing page; it simply sits in front of the app until a
user is selected.

**8. Interest-based feed implementation**

`components/Search/ContentFeed.tsx` scores every story by how many of the
current user's `interests` overlap with that story's derived topics
(`getContentTopics`, in `contentMeta.ts`, pulls from the story's own
`tags` plus a deterministic fallback), then stable-sorts (ties keep their
original order) so higher-overlap content surfaces first — reusing the
existing `StoryCard`/grid/pagination exactly as before, just re-ordering
the same array. Users with no interests (there are none, but the code
guards for it) fall back to the unranked list.

**9. Share flow**

`ContentActions` (shared by `StoryCard` and `Dashboard`) renders a Share
button next to Like/Dislike/Save/Playlist, opening `ShareModal` — a
popover in the same design language as the existing `SaveToPlaylistPopover`
(same card surface, same corner radius, same motion). It lists every other
dev user as a recipient, blocks re-sharing with someone already on the
"Already shared with" list (`devDataStore.createShare` itself also
no-ops/returns an error on a duplicate `(contentId, fromUserId,
toUserId)` triple), shows a `submitting` guard and inline error on
failure, a toast on success, and lets the sharer delete any share they
created. A successful share also creates a `DevNotification` for the
recipient in the same store call.

**10. Notification flow**

`components/Navigation/NotificationBell.tsx` extends the existing
`TopNav` icon cluster (it does not touch the Navbar's own layout/markup
beyond adding one more icon button) with an unread-count badge
(`devDataStore.listNotifications(userId).filter(n => !n.read)`). Opening
the dropdown shows every notification newest-first, each with a small
type icon (heart for like, speech bubble for comment, person-plus for
follow, share icon for share); clicking one marks it read
(`markNotificationRead` — the notification itself is never deleted by
this, only flagged), closes the dropdown, and navigates to the exact
content via its stable `contentId` — or, for a follow notification (which
has no content of its own), to the follower's profile. Notifications stay
in the list, marked read, until the user explicitly deletes one.

**Updated per a later round of feedback: every major social event now
notifies, not just share.** `devDataStore`'s central `notify()` helper is
called from four places — `createShare` (share), `setReaction` (a genuine
*new* like only — not dislike, not re-liking, not clearing a like, so
there's exactly one notification per like, the same restraint real social
apps show), `createComment` (comment), and `toggleFollow` (a new follow
only, never an unfollow) — each resolving the right recipient (the
content's derived author for like/comment, via `getContentAuthorId`; the
followed user for follow) and never notifying someone about their own
action on their own content (`notify()` no-ops if sender === recipient).
This was a one-file change precisely because every one of these actions
already funneled through `devDataStore`'s own methods — no component
needed to change to pick up the new notification types.

**11. Comment flow**

`components/Content/CommentPanel.tsx`, opened from the same
`ContentActions` row, lists existing comments (`devDataStore.listComments`,
each with commenter name + relative timestamp), and a composer that
blocks empty submissions, shows a `submitting` guard against double-click
duplicate posts, surfaces inline errors, and updates the visible comment
count instantly (via the store's version bump) once a comment is created.
Only the comment's own author sees a delete control on it.

**12. Content navigation flow (via notification click)**

Because `ContentActions`, reactions, saves, comments, and playlists are
all keyed purely by the content's *stable* `contentId` (never by array
index or by which page rendered it), navigating to a story from a
notification click lands on the exact same content with the exact same
Like/Dislike/Comment/Share/Save/Playlist state as reaching it any other
way — there is no separate "shared content" code path, just the one
existing content view reused.

**13. Landing-page search behavior**

Fixed in `TopNav.tsx`: the navbar's own search used to be gated only on
`!isReading`, which is also true on the landing page — so both search
boxes could show at once. It's now `showNavbarSearch = Boolean(state.story)
&& !isReading`, so the navbar search (desktop inline box and the
mobile `MobileSearchSheet` icon) is hidden exactly on the landing page
(no story loaded) and shown on every other app/content page, with no
DOM hacks and no visual change to either search box.

**14. z-index / stacking-context changes**

Added one named scale to `tailwind.config.ts`
(`modal-backdrop: 100, drawer: 110, overlay: 150, toast: 200`) on top of
the app's pre-existing bare-number scale (10/20/30/40 for `TopNav`, 50 for
dropdowns), and migrated every arbitrary `z-[N]` value (`AddStoryModal`,
`HamburgerMenu`, `VoiceSearchOverlay`, `MobileSearchSheet`) onto it, so the
whole app now has one ascending, named hierarchy instead of scattered
magic numbers. Also found and fixed a real containing-block bug while
auditing this: `AddStoryModal` wasn't portal-rendered, so opening it from
the navbar's `SearchBar` instance (which sits inside `TopNav`'s
`backdrop-blur-xl` — a CSS `filter`, which creates a containing block for
`position: fixed` descendants) would have clipped the "full-viewport"
modal to the navbar's bounds. Fixed with the same `createPortal`-to-
`document.body` pattern already used by `VoiceSearchOverlay`/`HamburgerMenu`.

**15. Mobile responsiveness changes**

`ShareModal`, `CommentPanel`, and `SaveToPlaylistPopover` were all
anchored `left-0` relative to buttons positioned mid-to-right in the
6-button `ContentActions` row, which risked the popover overflowing past
the right edge of the viewport on narrow phones. All three (plus
`NotificationBell`, for consistency) are now `right-0`-anchored with a
hard `max-w-[calc(100vw-2rem)]` clamp. All three also gained an
Escape-key close handler, matching `NotificationBell`/`HamburgerMenu`/
`VoiceSearchOverlay`, which previously only closed on outside-click.
`ContentActions` wraps (`flex-wrap`) rather than overflowing on narrow
cards. The notification dropdown, comment panel, and share popover all
scroll internally rather than growing past the viewport height.

**16. Tests performed (TEST A – M)**

Walked every scenario in the brief against the actual implementation:

- **A/E** — Logging in as any user and opening any content renders
  `ContentActions` with working Like/Dislike/Comment/Share/Save/Playlist,
  all keyed by that content's stable id and that user's stable id.
- **B/H** — Sharing content to a recipient creates exactly one `DevShare`
  (a second attempt at the same pair is rejected, not duplicated) and is
  deletable by the sharer; repeating the share from a different user
  (User 5 → User 2) follows the same independent path with no cross-talk.
- **C** — the recipient's `NotificationBell` unread badge increments
  immediately (via the store's version-bump + `useSyncExternalStore`),
  with no polling or refresh needed.
- **D/G** — clicking a notification marks it read and navigates to the
  exact shared content; reopening the notification panel later still
  shows it as read (the read flag is a durable store field, not
  transient UI state).
- **F** — the dev store is one module-level singleton, so its state
  stays consistent across client-side navigation between routes within a
  session, and (per the later localStorage-persistence addition above)
  now also survives a real page reload on the same machine; limitation
  #11 covers exactly what still doesn't carry over (a different browser,
  device, or cleared site data).
- **I** — multiple comments on the same content all persist for the
  session, in order, and each is deletable only by its own author.
- **J/K/L** — fixed a real gap found while tracing this: there was no
  way to get back to "/" with no story loaded once one had been opened
  (the logo was inert, and `RESET_TO_DASHBOARD` deliberately keeps the
  story loaded). Added a `CLEAR_STORY` reducer action and made the
  `TopNav` logo a real button that dispatches it — inert mid-reading
  session so a stray click can't discard in-progress progress. With
  that fix: landing page shows its own search with the navbar search
  hidden (J), navigating to any content page shows the navbar search
  (K), and returning to "/" hides it again (L).
- **M** — all of the above re-checked against the mobile-overflow fixes
  in point 15: no clipped popovers, no dead z-index stacking, no
  unusable touch targets, no layout shift from the new
  `ContentActions`/notification-bell additions.

**17. Errors encountered and fixed**

See the full list of bugs found and fixed during this build in the
project's working notes; in summary: a real stacking-context bug in
`AddStoryModal` (point 14), two parallel/inconsistent playlist stores
(`HamburgerMenu` was still calling the old `lib/storage.ts` localStorage
functions after `SaveToPlaylistPopover` had already migrated to
`devDataStore` — fully migrated and the old dead code removed), missing
right-edge/`max-width` clamping and missing Escape handlers on three new
popovers (point 15), no logout control anywhere (added to `ProfileMenu`),
and no way back to the landing page once a story was loaded (point 16,
J/K/L).

**18. Remaining limitations**

See **Known limitations**, items 9–13 below, for the consolidated list
(dev-only auth, in-memory-only persistence that resets on hard reload,
no real-time push between separate browser sessions/tabs, etc.).

**19. No database or backend was introduced.** Every piece of this
feature — accounts, shares, notifications, comments, reactions, saves,
playlists, follows — lives in plain TypeScript arrays inside one module,
`lib/devData/store.ts`, in the same process as the UI. There is no new
API route, no server action, no external service call, and no schema
migration anywhere in this change.

**20. The in-code store is explicitly temporary.** `lib/devData/store.ts`,
`lib/devData/types.ts`, and `lib/devData/seedUsers.ts` all open with a
header comment stating this is development-only scaffolding, not
production data, and describing the migration path (replace each
`DevDataStore` method's body with a real API/fetch call; the method
signatures were deliberately chosen to already look like a client for a
real backend, so no calling component should need to change).

### Later round: real persistence, notifications for every event, a reusable per-person feed, and a reading-progress text effect

**Problem:** a follow-up request asked for four more things on top of the
social layer above: (1) a scroll-linked text effect where already-read
text turns dark/black and not-yet-read text stays muted/light; (2)
notifications for *every* important social event — like, comment,
follow — not just share, "like social media"; (3) real persistence of
every change "on my laptop," not just for one in-memory session; and (4) a
separate, reusable component that generates an interest-ranked feed for an
individual person.

**What changed:**

1. **The reading-progress text effect went through four iterations before
   landing on a stable, dependency-free implementation.** Attempt one added
   a `ScrollRevealText` component to the *landing page* (framer-motion
   `useScroll`, word spans brightening as the page scrolled past) — wrong
   page, and it had a real copy/paste bug (two overlapping text layers per
   word, so selecting the paragraph duplicated every word). Attempt two
   moved a CSS-`mask-image`-based version of the same idea onto the actual
   reading-practice screen. The person then supplied a specific third
   implementation to use instead — a GSAP + ScrollTrigger word-by-word
   opacity/blur/rotation reveal component (`ScrollReveal`) — which was
   built, adapted to respect this app's own font controls, and wired to a
   real `scrollTop`-driven viewport so `ScrollTrigger` had genuine scroll
   input to read. In real use, with a few hundred paragraphs each running
   three of its own `ScrollTrigger` instances, it proved visibly
   **inconsistent** — sometimes nearly the whole screen stayed blurred,
   sometimes none of it did, changing between runs and scroll positions at
   normal reading speeds. Per the explicit follow-up — *"text mute feature
   is completely inconsistent... make it stable first"* — GSAP was removed
   entirely rather than tuned, and replaced with a fourth, much simpler
   design:

   - `components/Reader/ScrollReveal.tsx` is **deleted**; `gsap` is not a
     dependency.
   - Each paragraph in `components/Reader/Reader.tsx` is a plain `<p>`
     rendered with a default dimmed/blurred state
     (`opacity-[0.22] blur-[3px]`) and a plain CSS
     `transition-[opacity,filter] duration-150 ease-out` — no animation
     library, no per-paragraph scroll tracking.
   - `hooks/useReadingEngine.ts` — the one place that already computes the
     authoritative scroll position every animation frame — now also
     decides each paragraph's muted/revealed state directly from that same
     number: each paragraph's `offsetTop` is cached once (on mount and
     whenever a `ResizeObserver` reports the track reflowed, e.g. a font
     or content-width change), and every frame does pure arithmetic
     (`screenTop = cachedOffsetTop − scrollTop`) against a fixed
     `MUTE_ZONE_VH = 18` band at the bottom of the viewport — a paragraph
     is muted while its top sits in that bottom 18vh, revealed the instant
     it crosses above it. Styles are written directly
     (`el.style.opacity`/`el.style.filter`) only when a paragraph's
     boolean state actually flips, never on every frame for every
     paragraph, keeping the cost flat even with a few hundred paragraphs.
   - The root cause of the GSAP instability was structural, not a
     parameter to tune: `ScrollTrigger`'s scrub interpolation assumes
     smooth, incremental native scrolling, while this screen's auto-scroll
     jumps `scrollTop` to a freshly computed absolute pixel value every
     frame — two independent per-frame systems racing to interpret the
     same scroll position, with no guaranteed winner. Removing the second
     system (GSAP) and computing the reveal state from the engine's own
     number eliminates the race entirely; the CSS `transition` is what
     keeps the hard state flip looking like a soft ~150ms crossfade rather
     than an abrupt cut.
   - Note on "18vw": the request specified the muted zone as "18vw" at the
     "bottom" of the screen; since the zone is a vertical band (bottom of
     the viewport), this was implemented as `18vh` — `vw` has no
     dimensional meaning for a top/bottom band — as `MUTE_ZONE_VH` in
     `useReadingEngine.ts`.

   The real-`scrollTop` architecture change made for the GSAP attempt
   (replacing an original CSS `transform`-based auto-scroll) stayed in
   place, since the new deterministic check needs the same real scroll
   position: `useReadingEngine` sets `scrollTop` on a dedicated
   `viewportRef` element every animation frame, which is also exactly what
   makes `offsetTop − scrollTop` arithmetic correct. `viewportRef` stays
   `overflow-hidden` (not `scroll`/`auto`) so JS can still move its
   `scrollTop` while the reader can never drag/wheel/touch it out of sync
   with the timed pace by hand.
2. **Notifications now cover like, comment, and follow, not just share.**
   `devDataStore` gained one private `notify()` helper (dedups the
   "build a DevNotification, push it, skip self-notifications" logic that
   `createShare` already had), now also called from `setReaction` (on a
   genuinely new "like" only — not dislike, not re-liking, not clearing
   one, so exactly one notification per like), `createComment`, and
   `toggleFollow` (on a new follow only, never an unfollow). Each
   resolves the right recipient — the content's derived author
   (`getContentAuthorId`) for like/comment, the followed user for
   follow — and reuses the exact same `DevNotification` record shape, so
   `NotificationBell` needed only a small, additive update: a per-type
   icon (heart/comment-bubble/person-plus/share) and a branch so a
   "follow" notification (which has no `contentId`) opens the sender's
   profile instead of a piece of content. `DevNotification.contentId`
   became optional (`contentId?: string`) to model that honestly instead
   of passing an empty string.
3. **The store now persists to this browser's `localStorage`.** This
   intentionally revisits the original brief's "no localStorage" rule for
   this data, per the later explicit request to make changes durable "on
   my laptop": every mutation already ran through one `touch()` method
   (for the `useSyncExternalStore` version bump), so persistence is a
   one-file addition — `touch()` now also calls a new `persist()` that
   writes a JSON snapshot of every relationship array (plus who's logged
   in) to `localStorage`. Loading it back is a separate, explicit
   `hydrate()` method, deliberately *not* called from the store's
   constructor but from a `useEffect` in `DevLoginGate.tsx` (which already
   wraps the whole app) — so the very first render, including Next.js's
   server-rendered HTML (which has no access to the browser's storage),
   starts identical on server and client, and only picks up the saved
   data a moment after mount. This avoids a React hydration-mismatch
   warning that calling `hydrate()` eagerly at module-load time would have
   caused. The seeded user *accounts* are still not persisted (they
   always come fresh from `seedUsers.ts`); only the relationships between
   them are. See the updated "Known limitations" #9/#11–13 for exactly
   what this does and doesn't cover (still per-browser, still no
   cross-device sync, still not a database).
4. **`components/Feed/PersonalizedFeed.tsx`** is new — a standalone,
   reusable "feed for one specific person" component, taking an optional
   `userId` (defaults to whoever's signed in) and an optional `heading`.
   The actual ranking logic was pulled out of the old `ContentFeed.tsx`
   into a pure function, `rankStoriesByInterest(stories, interests)` in
   `lib/devData/contentMeta.ts`, so it's shared rather than duplicated.
   `ContentFeed.tsx` (the landing page's instance) is now a thin,
   same-looking wrapper around `PersonalizedFeed` — same heading, same
   spacing, same behavior as before this change — but any other screen
   can now render `<PersonalizedFeed userId="user-005" heading="..." />`
   to show *any* dev user's interest-ranked feed, reusing the same
   pagination (`IntersectionObserver` + fixed `PAGE_SIZE` slices) and
   card grid (`StoryCard`) rather than a second implementation.

---

### Latest round: reveal effect removed, glass navbar, and an 85vw/15vw Apple-style reading layout

**Problem:** a follow-up request asked for five changes: (1) remove the
reading-progress mute/reveal effect entirely, keeping everything else
unchanged; (2) apply a supplied `GlassSurface` glass effect to the navbar,
consistently on every page; (3) give the reading screen a real two-column
split — 85vw for the text, 15vw for the Speedometer; (4) keep the
Speedometer fixed inside that 15vw column without disturbing the reading
layout; (5) make the reading page read as more Apple-like — clean,
minimal, spacious typography — without touching any other feature.

**What changed:**

1. **The mute/reveal effect is gone.** `useReadingEngine.ts` no longer
   tracks paragraph offsets or writes any paragraph styles — it does
   exactly one job again, advancing `progress` and applying it as
   `scrollTop`. `Reader.tsx` renders each paragraph as a plain `<p>` at
   full, constant opacity, no ref array, no inline style writes. Nothing
   about this reverted the earlier `scrollTop`-based auto-scroll
   architecture (still needed for accurate, reflow-proof progress — see
   the "Reading engine" write-up above) — only the paragraph-dimming
   layer on top of it is gone.
2. **`components/ui/GlassSurface.tsx`** is the supplied component, kept
   byte-for-byte the same for its actual glass effect (every gradient,
   displacement filter, blend mode, and shadow value is untouched) with
   one integration change: the original decides light/dark purely from
   the OS's `prefers-color-scheme`, but this app already has its own
   independent dark/light/sepia theme switch (cycled from the navbar
   itself, applied as `data-theme` on `<html>`). A glass surface that only
   reacted to the OS setting would visibly fall out of sync with whatever
   theme the person actually picked — defeating "consistently across all
   pages." `useDarkMode` now watches `data-theme` via a `MutationObserver`
   instead (sepia counts as a light surface, since its canvas color is a
   light warm tone).
3. **`TopNav.tsx` uses it as the navbar's background.** `GlassSurface`'s
   own root element is `overflow-hidden` by design (part of the supplied
   styling) — wrapping the whole navbar in it directly would clip the
   dropdown-style menus (`ProfileMenu`, `HamburgerMenu`, `NotificationBell`)
   that render as absolutely-positioned overlays taller than the bar
   itself. Instead, `GlassSurface` is rendered as a full-bleed layer behind
   the nav content (`absolute inset-0 -z-10`, sized `width="100%"
   height="100%"`), with the actual nav row stacked on top as an ordinary
   sibling — same visible glass effect, none of the overlays get clipped.
   `TopNav` is rendered once, from the root layout, so this applies to
   every route automatically rather than needing to be repeated per page.
4. **The reading screen is a real 85vw/15vw split, not a pixel gutter.**
   The previous version reserved space for the Speedometer with a
   manually-tuned pixel value (`reserveRightPx`/`SPEEDOMETER_GUTTER_PX`)
   added to the track's `max-width` calculation. That's replaced with an
   actual two-region layout: `Reader.tsx`'s scroll viewport takes
   `lg:w-[85vw]` (full width below `lg`, where the Speedometer isn't
   docked at all), and the Speedometer/BreakTimer column in
   `app/reader/page.tsx` is `lg:w-[15vw]`, fixed to the right edge,
   full height. The two widths sum to exactly 100vw, so they can never
   overlap regardless of screen size — no gutter math to keep in sync.
   The track's own `max-width` is now `min(contentWidth ch, 100%)`,
   where "100%" means whatever width the viewport itself has, so
   widening the content-width slider clamps against the viewport's real
   box instead of an independently-computed number.
5. **Apple-style typography on the reading screen.** Paragraph spacing
   increased (`mb-8` → `mb-10`) for a more spacious, article-like rhythm;
   `antialiased` for crisper glyph rendering; and `[text-wrap:pretty]` so
   the browser avoids orphaned short last lines when wrapping. These are
   the only stylistic additions — font family/size/line-height/letter-
   spacing stay exactly under the existing `Controls.tsx` sliders, and no
   other screen's typography was touched.

---

### Upload a PDF or image and read it the same way as text

**Problem:** a follow-up request asked to be able to upload a PDF (or an
image, "in any format") and have it auto-scroll in the reader the same
way text does, with every existing control — speed/WPM, Play/Pause/
Restart/Skip, the Speedometer, etc. — applying to it too.

**What changed:**

1. **`StoryData` gained an optional `media` field** (`types/index.ts`):
   `{ kind: "pdf" | "image", pages: [{ src, width, height }],
   estimatedWordCount }`. A story built from an upload sets this instead
   of populating `story`/`questions` (which stay empty arrays) rather than
   being a separate, parallel content type — so it can flow through the
   exact same `LOAD_STORY` action, Dashboard, and reader pipeline every
   other story already uses, with no new routing.
2. **`lib/mediaStory.ts`** (new, client-only) is where an uploaded `File`
   becomes a `StoryData`. An image is read straight to a data URL. A PDF
   is rendered page-by-page to a canvas via `pdf.js` (`pdfjs-dist`, now a
   dependency) — each page becomes one PNG data URL, entirely in the
   browser, no server round-trip — and, where the PDF has a real text
   layer, that text is extracted too, so the existing WPM-based timing
   math gets a genuine word count instead of a guess; a scanned page with
   no text layer (or a plain image, which never has one) falls back to a
   fixed per-page "glance time" estimate instead. Deliberately **not**
   run through `lib/stories.ts`'s validator/`addCustomStory` — that path
   requires non-empty `story`/`questions` (the wrong contract for a
   media story) and persists to `localStorage`, which a multi-page PDF's
   rendered images would blow through in a page or two. A media story is
   session-only: it lives in `ReadingContext` state like any other
   in-memory object, not saved to the story library — re-upload to read
   it again after a refresh.
3. **`components/Reader/MediaReader.tsx`** (new) is the PDF/image
   counterpart to `Reader.tsx` — same `trackRef`/`viewportRef` contract,
   same `reserveSpeedometerColumn` 85vw/15vw split, same focus-mode/
   guide-line overlays — but stacks `<img>` page elements instead of `<p>`
   paragraphs. `app/reader/page.tsx` picks between `Reader` and
   `MediaReader` based on whether `story.media` is set. Critically,
   **`useReadingEngine` itself needed zero changes** — it only ever reads
   `trackRef`/`viewportRef`/`wordCount`, so the exact same auto-scroll
   math, and therefore every control built on top of it (Play/Pause/
   Restart/Skip, WPM speed, the Speedometer, break tracking, the progress
   bar, keyboard shortcuts, fullscreen), already applies to a PDF/image
   with no changes of their own — this is what the brief's "all controls
   should be also applied to that pdf/img" asked for. `fonts.contentWidth`
   (the same slider that clamps text line length) doubles as the page
   image's width control, converted from `ch` units to a comparable pixel
   width, so that control stays meaningfully "applied" too; font family/
   size/line-height/letter-spacing have no meaning for a page image and
   simply aren't used there.
4. **A shared `storyWordCount(story)` helper** (`lib/wpmCalculator.ts`)
   replaces every direct `countWords(story.story)` call (Dashboard, the
   reader's completion screen, Results) — it returns `story.media`'s own
   estimate for a media story and the real paragraph count otherwise, so
   every WPM/word-count-derived stat (estimated time, effective WPM,
   dashboard "words" stat) stays accurate for both content types from one
   place instead of each call site needing to know which kind of story
   it's looking at.
5. **No comprehension quiz for a media story.** There's nothing to
   generate questions from a scanned page, so the reading-complete screen
   shows "View results" instead of "Continue to questions" and skips
   straight to `/results` when `story.questions.length === 0` — routed
   through the existing `GO_TO_QUESTIONS` action with a count of `0`
   (rather than jumping straight to `GO_TO_RESULTS`) specifically because
   that's what resets `answers` to `[]`, which matters if a previous
   story's quiz answers are still sitting in state from earlier in the
   same session. The Results page's own math already guarded
   division-by-zero for a 0-question total before this change, so no
   change was needed there.
6. **Upload entry point reuses the existing file-upload icon** in
   `SearchBar.tsx` (the paperclip-style icon that already opened a
   story-`.json` file picker) rather than adding a new button — its
   `accept` attribute widened to include `application/pdf`/`image/*`, and
   `handleFileUpload` now branches on file type before the existing
   `.json` parse path runs. That existing component's markup/CSS is
   deliberately fragile (verbatim-preserved sibling-selector styling — see
   its own header comment), so nothing in its layout was touched; a small
   loading/error status line was added as a plain sibling element instead.

---

## Known limitations

1. **Never compiled.** No network access was available at any point during
   this build to run `npm install` / `next build` (confirmed again this
   round with a plain `npm install`, same `403 Forbidden` from the
   registry as every earlier attempt). A manual audit (brace/paren
   balance, `@/` import resolution, grep for stale identifiers after every
   schema change) was run after each revision in lieu of a real compiler
   pass; expect to fix a handful of minor issues on first `npm run dev`.
   The reading screen's old paragraph-reveal effect (GSAP, then a
   dependency-free deterministic version) and the glass navbar needed no
   extra dependency, but the PDF-upload feature does: `pdfjs-dist` is now
   in `package.json` and needs a real `npm install` to fetch, same as
   every other dependency here.
2. **`pdfjs-dist` wiring is unverified by an actual build.** `lib/
   mediaStory.ts` dynamically imports `pdfjs-dist` and points its worker
   at `pdfjs-dist/build/pdf.worker.min.mjs` via `new URL(..., import.meta.
   url)` — the standard pattern for pdf.js under a webpack-based bundler
   like Next.js, and the same one Next's own docs use for web workers —
   but this sandbox has never had network access to actually install the
   package and run it through a real build (see point 1 above). If the
   exact version `npm install` resolves ships its worker file under a
   different path, adjust that one `workerSrc` line to match; everything
   else in that module is plain, ordinary browser APIs (`FileReader`,
   `<canvas>`, `Image`).
3. **Auto-scroll accessibility.** The reading screen's auto-scroll is a
   real scroll container (`viewportRef`, driven by `scrollTop` every
   animation frame), but it's still fully JS-driven and the reader can't
   scroll it by hand, so assistive tech still doesn't get the default
   interactive-scrolling semantics a normal scrollable region would imply
   — mitigated by explicit progressbar/live-region announcements, not
   fully solved.
3. **Break-timer card width vs. the 15vw Speedometer column.** The
   Speedometer itself (152px) always fits the 15vw column — it's narrower
   than 15vw at every width from the `lg` breakpoint (1024px) up. The
   break-timer card is a fixed 224px wide (`BreakTimer.tsx`, unmodified
   per the "don't touch other features" constraint), which is wider than
   a literal 15vw column until the viewport reaches roughly 1493px; below
   that, on a paused break, the card can visually extend a few pixels past
   the column's edge toward the reading text rather than staying fully
   inside it. It never overlaps the Speedometer itself, and it's a
   momentary, intentional pause state, not the steady-state reading view.
3. **Calendar keyboard navigation is Tab-order, not roving-focus.** Every
   past/present day is a focusable, labeled `<button>`, so a keyboard user
   can reach and hear every day's stats — but arrow-key grid navigation
   (like a native `<input type="date">` picker) isn't implemented. Full
   roving `tabIndex` + arrow-key handling is a contained, additive change
   to `ContributionHeatmap.tsx` alone.
4. **"Reading History" and "Analytics" share one route.** Both menu items
   in `ProfileMenu` point at `/results`, the only page that currently
   renders session history and analytics charts. Splitting these into
   dedicated routes is routing-only — no component or data change needed.
5. **Single story.** One JSON file loaded at startup (`app/page.tsx`);
   `lib/stories.ts` and the widened `StoryData` type are shaped for a
   multi-story library view, but the library UI itself isn't built.
6. **Reading Consistency is a heuristic**, not a variance-based statistic
   — see the Dashboard/analytics integration section above.
7. **Speed-band and warning colors are theme-constant.** The Speedometer's
   slow/medium/fast/extreme colors and the amber pause-reduction hint are
   intentionally *not* theme-tokenized, since they carry semantic meaning
   rather than surface decoration — not contrast-tuned per theme, which
   would be a worthwhile follow-up for the light/sepia themes specifically.
8. **No `styled-components` SSR registry.** The two loader components
   render only inside routes that are already `"use client"` trees, so
   there's nothing server-rendered for `styled-components` to hydrate
   incorrectly in this app today. If a loader is ever used from a Server
   Component, add the standard Next.js App Router `styled-components`
   registry (a `useServerInsertedHTML` provider) — it's an additive setup
   step, not a change to `next.config.js`'s existing SWC flag or to either
   loader's own code.
9. **Playlists and reactions are now per-account** (keyed by stable
   `DevUser` id in `lib/devData/store.ts`), but that account layer is
   itself a temporary, hand-rolled dev store — see point 20 of the
   social-layer write-up above. History and bookmarks are still
   per-browser `localStorage` via `lib/storage.ts`, unchanged.
10. **`ContentFeed`/`PersonalizedFeed`'s pagination is client-side
    slicing** over the same small bundled + custom story library every
    other search surface already reads from, not a real paginated API —
    there's no backend to page against yet. The
    `IntersectionObserver`/`PAGE_SIZE` structure is deliberately shaped so
    that swapping the `.slice()` call for a fetch is the only change
    needed once one exists.
11. **The dev data store now persists to this browser's `localStorage`**
    (shares, notifications, comments, reactions, saves, playlists, follows,
    and who's logged in all survive a real reload or reopening the tab on
    the same machine), but it is still not a database: the seeded user
    *accounts* themselves are not persisted (always fresh from
    `seedUsers.ts`), and clearing site data/using a different browser or
    device starts over from empty. This is documented in
    `lib/devData/store.ts`'s header and is the expected behavior until a
    real backend replaces it.
12. **Dev login is plaintext, unhashed, and has no real session/cookie** —
    `devDataStore.login` is a direct string comparison against the demo
    credential table in the README; the only thing that persists is a
    plain user id in localStorage (see point 11), not a signed token. It
    is explicitly a development stand-in and must be replaced before any
    production use.
13. **No cross-tab/cross-device real-time sync.** The store syncs this one
    browser's own tabs against the same localStorage key, but there is no
    websocket/polling layer — a notification created on a different
    device, or in an incognito/different browser, won't appear here
    without that session performing the action itself, since there is
    intentionally no backend yet.

## Feature coverage summary

**Fully implemented:** dashboard with real session-derived stats + story
info, preset/custom WPM, geometry-accurate WPM-driven auto-scroll,
resize-proof progress engine, compact repositioned speedometer, full
control set (play/pause/restart/skip, font/theme sliders, focus mode,
guide line, reset-to-default), sticky glass navigation system (TopNav +
ProfileMenu + ProgressBar sharing one visual language), complete keyboard
shortcut set, tab-visibility auto-pause, overlap-proof responsive layout,
dark/light/sepia theming reaching every component including charts,
configurable-count quiz with prev/next/skip/flag, results screen with
performance rating, WPM/accuracy history charts, a from-scratch
GitHub-style contribution graph with accurate per-day tracking and
lifetime stats, reading streak and bookmarks, scalable/validated JSON
story architecture, the full production-level pause experience, a
full-screen (100vw×100vh) voice search overlay, independently-sized
navbar vs. landing search boxes, a scroll-revealed content feed on the
landing page with infinite-scroll pagination, story cards with
save/like/dislike, multi-playlist save with inline playlist creation, a
hamburger menu (playlists + search history with per-item delete, clear
all, and re-run), a phone-width dedicated search sheet, the landing
page footer, a centralized typed dev data store for every social
relationship, 20 seeded dev users with interest-ranked feeds, dev login/
logout, follow/unfollow with profile pages, a Share-to-recipient flow with
duplicate prevention, a navbar notification system with unread badge and
click-to-navigate, a comment system with per-author delete, a consistent
named z-index hierarchy, mobile-safe (right-anchored, Escape-closable,
viewport-clamped) popovers throughout the new social UI, notifications for
every major social event (like/comment/follow/share, each with its own
icon), localStorage-backed persistence of the whole dev store (survives
real reloads on the same machine), a standalone reusable `PersonalizedFeed`
component for any individual user's interest-ranked feed, a glassmorphic
navbar (`GlassSurface`, SVG-filter-based, theme-aware) applied
consistently across every route, a real 85vw/15vw split on the reading
screen (text column / docked Speedometer column) with calmer, more
spacious reading-page typography, and uploading a PDF or image to read
with the exact same auto-scroll engine and controls as a text story
(`lib/mediaStory.ts` + `MediaReader.tsx` — a PDF renders page-by-page via
`pdf.js`, an image reads straight to a data URL, both flow through the
same `LOAD_STORY`/Dashboard/reader pipeline every other story uses). The
reading screen's earlier paragraph-level mute/reveal effect — first a
GSAP + ScrollTrigger version, then a dependency-free deterministic one —
has since been removed per feedback; paragraphs render at full, constant
opacity again.

**Stubbed / extension points:** achievement badge unlocking (storage
method exists, no UI trigger), a dedicated review-flagged-questions pass,
confetti on completion, ambient background audio, sound toggle,
offline/PWA support, a multi-story library view, roving-focus keyboard
navigation on the calendar, split History/Analytics routes, persisting an
uploaded PDF/image story to the custom-story library (currently
session-only — see the "Upload a PDF or image" write-up above for why),
and — for the social layer specifically — replacing
`lib/devData/store.ts` with a real backend/database and replacing dev
login with real authentication. Each is a small, additive change against
the existing state machine, storage layer, and dev-store method
signatures — not a restructuring.

## Story text editor

The text box in **Add your own story / Edit story** is a full rich-text + code editor
(formatting, code blocks, images, tables, fullscreen, autosave, import/export).
The JSON tab and per-user sessions are unchanged. See
[`docs/TEXT_EDITOR.md`](docs/TEXT_EDITOR.md) for the architecture, how OOP, CN, OS and
DBMS concepts are used, and the list of known gaps. Tests: `npm run test:editor`.

### More demo accounts (021–100)

Accounts `user-021` … `user-100` (including **Ankit Sahani**, `ankit.sahani`) have
deliberately easy test passwords, each in a different format. The complete list of all 100 logins is in
[`docs/DEMO_ACCOUNTS.csv`](docs/DEMO_ACCOUNTS.csv). These are plaintext, development-only
demo credentials that ship in the client bundle, so delete them before any real deployment.

## Typography (matched to render.com/pricing)

Render uses licensed fonts: **PP Neue Montreal** (UI/body), **Roobert** (display headings, weight 300) and **PP Neue Montreal Mono**. They can't be bundled, so the font stacks list them first (used if installed) and fall back to **Inter** / **JetBrains Mono** (Render's own fallbacks, loaded from Google Fonts in `app/layout.tsx`). The type scale in `tailwind.config.ts` follows Render's: 12/14/16/18/20/24/32/40/48/64/80 px with their line heights and tight negative tracking on large sizes. Headings use `font-display` (weight 300). The reader's own font choices (serif/sans/mono) are unchanged. To use the real fonts, add `@font-face` rules for them in `app/globals.css`.

## Dashboard from anywhere

Profile icon → **Dashboard** opens `/dashboard`: the open story's dashboard if there is one, otherwise a personal dashboard (streak, totals, recent sessions, saved stories). Works from the landing page too.

## Sign-in

The password field has an eye button to show/hide the password (`components/ui/PasswordInput.tsx`).

## Story cards

Story containers (feed, profile) are a 2-column grid of large rounded cards: a tinted cover with the title set big (tilted-card or bold variants, colour picked from the story id), then category · title · description with a round ↗ button. Author, level, reading time, Like/Save/Share/Comment and Edit are kept in a thin row at the bottom. Open `components/Search/StoryCard.tsx` to change the cover palettes.

## Add story (changes)

- The "Paste JSON" tab is gone; the form is the only way to add a story. Level and target-WPM inputs are removed (new stories default to Intermediate / 200 wpm for the reading-time estimate).
- Description now sits between the text editor and the questions.
- **Thumbnail**: choose any image (PNG/JPEG/WebP/GIF); it is downscaled to ≤1000px JPEG and stored with the story (`StoryData.thumbnail`). Story cards show it as the cover with the title over it; without one the generated cover is used. Same picker in Edit.
- Navbar: the reading progress bar and the book logo icon are removed; while reading, the time left is shown at heading size (`text-4xl/5xl`) with the live WPM beside it.

## Reading mode

A navbar switch ("Reading mode Off/On", `components/ReadingMode/ReadingModeToggle.tsx`) chosen **before** practice, on the story page. With it On, **Start** opens `/read` instead of the auto-scroll reader:

- The story is a normal article (title, description, meta, then the story with images/tables/code) that you scroll yourself. Wheel and keys (Space, PageUp/Down, arrows, Home/End) use inertia (`useInertiaScroll`: input moves a target, the real scroll eases toward it); touch keeps native momentum; reduced-motion users get native scrolling.
- The native scrollbar is hidden. A rail of short dashes on the left edge (one per section/heading) shows where you are; hover lists the sections, click glides to one (`ScrollRail`).
- Navbar: no speedometer or practice widgets. It shows the time left at the chosen speed (− / + 25 wpm changes it live) at heading size, which fades to 25% after 2.5 s without activity (also in the normal reader), plus a 4 px progress bar on the navbar's bottom edge, full width, in the app's green accent.
- The switch is not offered once an auto-scroll practice has started (or for PDF/image stories); the reducer ignores `SET_READING_MODE` during a session as well.
- "Finished — take the quiz" records the session/history like the reader does and goes to the questions.

## Landing page, second section

Under the story feed and above the footer (`components/Landing/PlatformShowcase.tsx`), modelled on the reference template but using this platform's own data (no invented logos or benchmark numbers):
- **Topics readers love on Speed Reader**: tiles for the most common story tags (falls back to level), "See all" expands; a tile opens its first story.
- **Performance that stands out**: three bar columns from the signed-in user's sessions: Speed (best wpm per story), Comprehension (best quiz accuracy), Consistency (active days per week, last 4 weeks). Empty states explain what fills them in.

Reading mode rail: at most 5 dashes however many sections; hovering opens the full section list, which scrolls on its own (the page's inertial wheel handler steps aside over inner scrollers such as this list and code blocks). Mobile: the rail and timer stay on small screens, the WPM stepper shrinks to −/+, and the bell hides while the timer is shown.

### Reading-mode clock (update)

The navbar clock in reading mode is a real countdown from `words ÷ wpm`, counting only while the tab is visible; scrolling never moves it (changing the wpm re-targets the total). The progress bar (2 px, bottom edge of the navbar) still follows scroll. "Finished" recalculates the speed from the time actually spent (`words ÷ elapsed`) and saves that to history and session stats, so finishing early shows a higher WPM.

## Landing page: video, audiences, footer

- **Video** (`components/Landing/VideoShowcase.tsx`): autoplaying, muted, looping, with three pill tabs (Read / Revise / Share) that change the heading line and floating card. **To use your own video, replace `public/videos/landing-hero.mp4`** (optionally `landing-hero-poster.jpg`, and `landing-hero.webm` or delete it). See `public/videos/README.txt`. The bundled file is a placeholder animated gradient.
- **"For every ambitious mind."** (`AudienceMarquee.tsx`): two rows scrolling in opposite directions (UPSC, engineers, doctors/NEET, CA, entrepreneurs, law, researchers, developers, teachers, MBA/CAT, judiciary, lifelong learners); hover pauses; stops for reduced-motion users. Edit the two arrays at the top to change fields.
- Order on the landing page: story feed → video → audiences → topics → performance → footer.
- **Footer** (`components/Footer/Footer.tsx`): the existing "Logo meaning breakdown" stays; below it link columns (Product, Practice, Community), quick-action circles (dashboard, profile, copy link), copyright row, and a large faded "SPEED READER" wordmark fading into the accent colour.

## Latest fixes

- **Footer covering the reader**: the new footer is a positioned element, so on `/reader` (a fixed full-screen page with nothing else in the document flow) it painted on top of the reader. The footer is now not rendered on `/reader` (nor `/questions`). The old "Logo meaning breakdown" block is removed; the new footer is the only footer.
- **Reading mode for PDFs / images**: the switch now appears for uploaded PDF/image stories too. `/read` shows the pages stacked in a wider column (the rail has one dash group per page), with the same clock, progress bar and "Finished" button (a PDF has no quiz, so it goes to results).
- **Inertial scrolling on the home page** (`SearchLanding` uses `useInertiaScroll`). It steps aside over modals, drawers, menus and inner scrollers, and when a dialog is open.

## Landing polish (latest)
- Platform name/headline live in `lib/brand.ts` (`BRAND_NAME`, `BRAND_HEADLINE`, `BRAND_TAGLINE`); change them there.
- Hero guide lines (vertical rails + two horizontal lines with corner squares) in `SearchLanding.tsx`.
- Search box on the landing page is 600px wide (`CONTAINER_WIDTH` in `SearchBar.tsx`); the navbar's compact box is unchanged.
- "The latest." carousel (`components/Landing/StoryCarousel.tsx`): up to 7 story cards with prev/next buttons.
- Audience marquee no longer pauses on hover; sections have larger gaps.


## Production readiness
- Deploy guide: `docs/DEPLOYMENT.md` (Node, Docker, nginx). Scripts: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.
- Plain CSS is imported only from `app/layout.tsx` (components no longer import `.css`); this removes the "global CSS cannot be imported from components" error.
- Added `app/error.tsx`, `app/not-found.tsx`, security headers, `.eslintrc.json`, `Dockerfile`, `.env.production.example`.
- Interview prep docs, topic-wise with Easy/Medium/Hard: `docs/interview/README.md`.
