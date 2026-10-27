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
