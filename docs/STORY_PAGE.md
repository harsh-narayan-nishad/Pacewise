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
- A speed wheel (`components/ui/OptionWheel.tsx`, from React Bits; wrapped by `ReadingMode/SpeedWheel.tsx`) sits at the left edge. Turn it to pick any reading speed.
- The navbar clock counts down from words ÷ wpm in real time. It starts when the controls appear and never depends on scrolling.
- All controls (section list, speed wheel, text size, bottom progress bar) appear once the hero has scrolled away and hide again as it returns from the top.
