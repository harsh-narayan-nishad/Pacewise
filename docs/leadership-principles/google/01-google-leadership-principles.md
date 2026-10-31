# Google's Leadership Principles

The ten headings below follow the "ten things" list that Google published about itself. The text under each is original and shows what the idea means when you are building Pacewise.

## 1. Focus on the user and all else will follow.

**In Pacewise:** a reader opens the app to understand a text faster, so every screen should serve that and nothing else.

- The story page puts speed, a time estimate and three clear actions where the reader's eyes already are.
- The numbers a reader sees (words per minute, time left, time per page) are about their own reading, not about the product.
- When a layout choice and a feature request pull apart, the reader's attention wins.

## 2. It's best to do one thing really, really well.

**In Pacewise:** the one thing is practising and measuring reading with comprehension.

- Quizzes, analytics and notes all exist to answer one question: did reading get faster and better?
- Features that do not help that answer wait. The docs site is a reference for builders, kept separate from the reading experience.
- Depth beats breadth: one reader with accurate timing, rather than five half-working modes.

## 3. Fast is better than slow.

**In Pacewise:** speed is the product, so the app must not be slow itself.

- A page that loads in under 150 ms shows no loader at all, and a slower page gets one centred spinner.
- Documentation is built ahead of time and pages scroll with eased inertia, so reading feels immediate.
- The search design budgets about 150 ms end to end and splits the budget across each step.

## 4. Democracy on the web works.

**In Pacewise:** a crowd's quiet signals are a useful input, used carefully.

- In the search design, links between a person's own documents act like votes, with a small weight and a damping factor so no single page dominates.
- What a reader opens and finishes can nudge ranking, but it never overrides a plain text match.
- The stack relies on open tools and open formats, so contributors are not locked in.

## 5. You don't need to be at your desk to need an answer.

**In Pacewise:** people read on phones, so the product has to work in a hand.

- Documentation opens from a QR code on a phone, after signing in.
- Layouts collapse for narrow screens, and extras such as the side rail are hidden where they would crowd the page.
- Touch targets are round, large and clearly labelled.

## 6. You can make money without doing evil.

**In Pacewise:** if the product ever earns revenue, the rules are set before it does.

- Nothing paid can change what a reader finds or how a result is ranked.
- Anything sponsored is labelled as such, and nothing interrupts reading.
- Personal reading data is not sold, and plans can be cancelled as easily as they are started.

## 7. There's always more information out there.

**In Pacewise:** useful text is not only plain notes.

- The search design reaches into PDFs, scanned pages and photographs by extracting text, with OCR where a page has no text layer.
- Results point to the exact page and highlight the matched words.
- The Research folder keeps adding new material, so the knowledge base grows with the product.

## 8. The need for information crosses all borders.

**In Pacewise:** readers use many languages, and speed is not the same across them.

- Text is normalised and its language detected before it is indexed.
- Reading-speed targets are personal, not tied to one language's average.
- Interface text and docs are written plainly, which also makes them easier to translate.

## 9. You can be serious without a suit.

**In Pacewise:** the tone is relaxed and the work is exact.

- Docs are written in plain language with real code, real numbers and real limits.
- Tests run in plain Node with no setup, so checking something is easy and therefore done.
- A joke in a commit message is fine; an untested change is not.

## 10. Great just isn't good enough.

**In Pacewise:** a working feature is the start of the next improvement.

- The speed wheel moved to where the decision actually happens. The clock now keeps counting after zero to show how late a reader is, because "time is up" alone said too little.
- Loaders were refined step by step: contrast, centring, start-up delay and timing, each one a small honest improvement.
- The search design lists its own weak points and the signal that will tell us when to change it.

---

*Headings follow the published Google list. The explanations are original and specific to Pacewise; they are not an official statement of Google.*
