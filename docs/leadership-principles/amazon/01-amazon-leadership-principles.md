# Amazon's Leadership Principles

The sixteen headings below follow Amazon's published list. The text under each one is original: it says what the principle means when the product is Pacewise, a reading-speed and comprehension platform with quizzes, personal analytics, documentation and a search engine.

## Customer Obsession

**In Pacewise:** the customer is a person who wants to read faster and still understand. Every feature is judged by whether it helps that person finish a story and remember it.

- The speed is chosen on the story's landing page, before the clock starts, so nothing about the reading itself is fiddly.
- The quiz measures understanding, not only speed, so a high words-per-minute number cannot hide poor comprehension.
- A loader appears only when a page really takes longer than 150 ms, because a spinner on a fast page is noise the reader never asked for.

**Question to ask:** would the reader notice if this were missing, and would they thank us for it?

## Ownership

**In Pacewise:** one person owns the whole product, from sign-in and per-user storage to the docs and the search design. There is nobody downstream to hand a half-fixed problem to.

- The "two clicks to reach the landing page" bug was not patched at the button. The cause was a story page that reloaded a story right after it was cleared, and that is where it was fixed.
- A fix is finished when the user confirms it, not when the code compiles. The hydration error was reported twice for exactly that reason.
- Documentation is part of the feature: if behaviour changes, the doc changes in the same delivery.

**Question to ask:** if this breaks next month, whose problem is it? If the answer is "mine", it deserves a test and a note.

## Invent and Simplify

**In Pacewise:** invent only where the existing tools do not fit, and then make the result small.

- The Markdown renderer for the docs has no dependency, supports exactly what the docs need (tables, captioned code, diagrams), and escapes everything first.
- Several syllabus chapters were merged into one Overview instead of keeping near-empty pages.
- The select-and-highlight tool was removed from the docs because it added weight without helping anyone read.

**Question to ask:** can this be done with fewer parts, and what would we delete if we had to?

## Are Right, A Lot

**In Pacewise:** be right by checking, not by feeling sure.

- Pure logic (grading, page timing, the overtime clock, the session isolation) lives in small functions with tests that run in plain Node.
- Capacity numbers in the search design are written down as assumptions and recomputed, so they can be argued with.
- When the assistant cannot run the app in a browser, the delivery says so, so the owner knows what still needs a real check.

**Question to ask:** what would prove me wrong, and have I looked for it?

## Learn and Be Curious

**In Pacewise:** the project has a Research folder and an Interview prep folder because learning is part of the work.

- Case studies of real systems (a tracker-network design, collaborative editing, search engines) were studied, then written up in the project's own words.
- Small details were looked up rather than guessed: how a spinner should start, how long a wait is worth hiding, how a blur material behaves.
- Every new technique earns a short note in the docs so the learning is not lost.

**Question to ask:** what did we not know a month ago that now changes how we build?

## Hire and Develop the Best

**In Pacewise:** there is no hiring yet, so this principle becomes "make the next contributor good quickly".

- The architecture doc ends with a short recipe for adding a per-user feature: one repository class, one line of registration.
- The docs explain the why of each decision, so a new person learns the thinking and not only the code.
- Interview prep pages turn the project's own work into practice material.

**Question to ask:** could a newcomer add a feature on day two using only the docs?

## Insist on the Highest Standards

**In Pacewise:** "works on my machine" is not the bar.

- Motion respects the reduced-motion setting, controls have labels, and icon-only buttons explain themselves on hover.
- Hydration problems, scroll glitches and layout overlap are treated as defects, not polish.
- A change ships with tests, a syntax check and an honest list of what was not verified.

**Question to ask:** would this survive a reviewer who wants to find the flaw?

## Think Big

**In Pacewise:** design for the size the product could reach, even while it is small.

- The search-engine design assumes a million users and hundreds of millions of documents, and shows that storage is easy while OCR, isolation and ranking are hard.
- Features are built on seams (a repository per feature, a facade over storage) so a real backend can replace local storage without rewriting the screens.
- A roadmap in phases keeps the big idea and the next small step visible together.

**Question to ask:** if ten thousand times more people used this tomorrow, what breaks first?

## Bias for Action

**In Pacewise:** most choices here can be undone, so they are made quickly and shipped in small steps.

- Work is delivered in short rounds, each one a working build the owner can try and correct.
- Phase one of search is a tiny bundled index, not a cluster, because it can be replaced later.
- Slow or irreversible choices (what data is stored about a person, what is deleted) get more thought, because they cannot be walked back.

**Question to ask:** is this decision reversible? If yes, decide now.

## Frugality

**In Pacewise:** constraints make the product better.

- Documentation is bundled at build time, so there is no docs server to pay for.
- Existing components (cards, buttons, the loader) are reused before new ones are written.
- Diagrams are hand-written SVG files, not a licensed tool, and heavy libraries load from a CDN only when a diagram opens.

**Question to ask:** what would we build if this had to run on a free tier?

## Earn Trust

**In Pacewise:** trust is kept by being plain about what the product does with a person's data and about what it cannot do.

- Reading time, test time and documentation time belong to one signed-in user and never mix with another's.
- Pages end with a "Limits" section that names what is not covered.
- Third-party images and posts were removed when their rights were unclear, instead of hoping nobody would mind.

**Question to ask:** would I be comfortable if the user read exactly how this works?

## Dive Deep

**In Pacewise:** the symptom is never the answer.

- A story page that flashed its middle before gliding to the top turned out to be page-wide smooth scrolling combined with a kept scroll position. The fix was one instant scroll before paint.
- A rendering error that survived one fix was traced to style text containing quotes, and fixed at its source in three places.
- Numbers shown to the user (time per page, totals) are recomputed in tests from known inputs.

**Question to ask:** have I seen the actual cause, or only guessed at it?

## Have Backbone; Disagree and Commit

**In Pacewise:** say so when a request will hurt the product, then build what was decided.

- Raise the concern with the reason and an alternative, once, in writing.
- Docs behind a sign-in is an example of a decision made for a clear reason (time can be attributed to a person), then carried out fully.
- Decisions are recorded in the docs, so a later change is a conscious reversal and not an accident.

**Question to ask:** have I said what I think, and once it is decided, am I building it fully?

## Deliver Results

**In Pacewise:** results are the numbers that show the product works.

- The key inputs are reading speed that holds up under a quiz, quiz accuracy, time to first useful screen and search latency.
- Each delivery names what changed, what passed, and what still needs a human to try.
- Setbacks (a failed test, a bad regular expression) are fixed and re-sent, not hidden.

**Question to ask:** which number moved because of this work?

## Strive to be Earth's Best Employer

**In Pacewise:** read it as "be the best place to work for the people who build it and the best product for people who use it daily".

- The break tracker shows how rest affects effective reading speed, so the product itself encourages healthy pace.
- Text size, contrast themes and reduced motion are options, not afterthoughts.
- Writing clear docs and small, testable code lets a contributor grow without fear of breaking everything.

**Question to ask:** will the person using or building this be better off for it a year from now?

## Success and Scale Bring Broad Responsibility

**In Pacewise:** as the audience grows, so do the duties.

- Personal data is stored per user, can be cleared by that user, and a deleted document is removed from search within a day in the design.
- Only content that may be shared is published, and credits are given where they belong.
- Cost, energy and bandwidth are watched: small pages, lazy loading, and no needless background work.

**Question to ask:** what does this look like if a million people depend on it?

---

*Headings follow the published Amazon list. The explanations are original and specific to Pacewise; they are not an official statement of Amazon.*
