# Story page

The page at `/` once a story is loaded (`components/Dashboard/Dashboard.tsx`).

## Layout (top to bottom)
1. **Hero** (`components/Dashboard/StoryHero.tsx`) – the story's uploaded video plays muted/looping, with the thumbnail as poster (falls back to the thumbnail, then a gradient). Title, a stats pill, **Read below** and a blue **Start reading** (practice mode) button.
2. Author / follow / content actions / Edit.
3. **The full story**, in reading mode by default (`ReadingModePage` with `embedded`) – no toggle needed.
4. Reading stats, About this story, Reading speed, Start reading + Bookmark.

## Reading extras (only while the article is in view)
- **Progress bar** fixed at `bottom-0`, in `BRAND_BLUE` (`#306fdb`, `lib/brand.ts`).
- **Section rail** on the **right** (`ScrollRail side="right"`), active mark in the same blue.
- **Text size** A−/A+ pill (80%–180%), remembered in `localStorage` (`speed-reader.story-font-scale`); implemented with the `--sr-scale` CSS variable in `readingMode.css` (`.sr-embedded`).

## Moved
"Past test attempts" now lives in the hamburger menu and opens `/history`.

## Unchanged
`/read` (the toggled reading mode) still uses the left rail and the navbar progress bar.

## Section list & speed wheel
- The right-hand section list is always open on wide screens; clicking one of the dashes scrolls to that section and hides/shows the list (`ScrollRail alwaysOpen`).
- A speed wheel (`components/ui/OptionWheel.tsx`, from React Bits; wrapped by `ReadingMode/SpeedWheel.tsx`) used to sit at the left edge of the article; it now lives on the landing hero (see below). Turn it to pick any reading speed.
- The navbar clock counts down from words ÷ wpm in real time. It starts when the controls appear and never depends on scrolling.
- The reading controls (section list, text size, bottom progress bar) appear once the hero has scrolled away and hide again as it returns from the top.

## Speed, clock and navigation on the story page

- **Speed wheel on the landing hero.** The words-per-minute wheel sits above the "day streak" line in the hero, so the speed is chosen before reading starts. The wheel is only on the landing hero (it is gone from the article). The speed buttons stay where they were: the reader's controls and shortcuts, and the navbar -/+ in reading mode.
- **Clock with overtime.** The navbar clock counts down from words ÷ speed. At 0 an alert appears once, the clock turns red and counts up with a "+" (for example `+0:07`), so you can see how late you are. The maths is `clockFace` in `lib/readingMode/progress.ts`; the alert is `useOvertimeAlert`.
- **Previous / Next on the hero.** Round icon-only buttons step the highlighted action between *Read below*, *Quiz* and *Start reading*; hover shows which action each one selects. They do not move on hover or click.
- **Opening glitch fixed.** The app sets `scroll-behavior: smooth` on the page, so opening a story from a scrolled landing page showed the article first and then glided up to the hero. `useScrollToTopOnMount` now jumps to the top instantly before the first paint.
- **Time analysis.** See [TIME_ANALYSIS.md](TIME_ANALYSIS.md).

## Navigation loader

The signed-in app covers the screen with the theme colour and a centred tick spinner while a page loads (`contexts/NavLoaderContext.tsx`): any internal link is covered automatically and `useNavLoader().push` covers code-driven navigation (story cards, the logo, the menu). A load under 150 ms never shows it. Docs pages do not get the full-screen loader: only their hamburger-menu rows show a small spinner, and the Prev / Next buttons keep their own. The logo now reaches the landing page in one click (the story route no longer reloads a story that was just cleared).
