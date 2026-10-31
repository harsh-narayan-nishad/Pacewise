# Uber's Leadership Principles

The eight headings below follow the cultural norms Uber has published. The text under each one is original: it says what the norm means when the product is Pacewise, a reading-speed and comprehension platform with quizzes, personal analytics, documentation and a search engine.

## We build globally, we live locally.

**In Pacewise:** one codebase has to feel right for readers in very different places.

- Text is treated as Unicode from the first step, and a document's language is detected before it is indexed, so a note in Hindi, Hinglish or English is handled the same way.
- Speed targets belong to the person, not to a country's average, because reading rates differ between languages and scripts.
- Dates, durations and numbers are shown in the reader's own locale; the logic underneath is the same everywhere.

**Question to ask:** what in this feature quietly assumes one language, one time zone or one device?

## We are customer obsessed.

**In Pacewise:** the customer is the learner, and their goal is understanding faster, not a bigger number on a dial.

- The quiz sits next to the speed result so a fast but shallow read is visible to the reader themselves.
- Screens are tuned by small moments: a loader that appears only after 150 ms, a clock that keeps counting after zero so lateness is visible, round icon buttons that explain themselves on hover.
- Feedback from the owner is applied literally and then checked, because the person using the product is the final test.

**Question to ask:** what would the reader do if we asked them to try this live?

## We celebrate differences.

**In Pacewise:** people read in different ways, and the product should bend to them.

- Light, dark and sepia themes, adjustable text size and a reduced-motion respect mode are part of the product, not extras.
- Reading speed is personal, and the analytics compare a person with their own past, not with a crowd.
- The docs are written in plain language so that someone new to a topic can follow, and someone experienced can skim.

**Question to ask:** who would struggle with this, and what small change would help them?

## We do the right thing. Period.

**In Pacewise:** when a shortcut and the right choice differ, the right choice wins, even when nobody would notice.

- Third-party images and posts were taken out when their rights were unclear.
- Documentation that was open to anyone now needs a sign-in, so reading time belongs to a real person and nothing is gathered anonymously.
- Limits are written down. A page that says what it does not cover protects the reader from false confidence.

**Question to ask:** would I be comfortable explaining this choice to the person it affects?

## We act like owners.

**In Pacewise:** the whole product is mine to keep working, not only the part I am touching.

- A bug is followed to its cause. The double-click on the logo came from a story page that reloaded a story that had just been cleared, so the fix went there.
- Tests, docs and the delivery note are part of finishing, not extras for later.
- When something cannot be verified here, the delivery says so plainly and names what still needs a human check.

**Question to ask:** if this fails at midnight, would I have wanted to leave it like this?

## We persevere.

**In Pacewise:** hard problems here took more than one try, and that is normal.

- A rendering error that survived its first fix was traced again to its real source: style text containing quotes.
- A loader went through several rounds (contrast, centring, delay, timing) until it looked right to the person using it.
- A regular expression that rejected valid input was corrected and re-sent, not left for later.

**Question to ask:** have I learned something from the last failed attempt, or am I repeating it?

## We value ideas over hierarchy.

**In Pacewise:** a good idea counts whoever it comes from, and a decision is judged on its reasons.

- Design choices are recorded with the alternative that was rejected and why, so a better idea can replace them later.
- Numbers settle arguments: a latency budget, a capacity estimate, a test result.
- Suggestions from users, reviewers and contributors are tried and measured rather than ranked by who made them.

**Question to ask:** if a newcomer proposed this, would the reasoning hold up?

## We make big bold bets.

**In Pacewise:** aim at the version of the product that would matter at scale, and take the next small step toward it.

- The search design reaches into PDFs, scanned pages and photographs, with a phased path from a tiny bundled index to a distributed engine.
- Storage sits behind repositories, so a real backend can replace browser storage without rewriting the screens.
- Each bet has a stop sign: a signal that tells us when to change course instead of defending the plan.

**Question to ask:** if this bet works, what does Pacewise become, and what is the cheapest way to find out?

---

*Headings follow the cultural norms Uber has published, [Uber's cultural norms](https://www.uber.com/newsroom/ubers-new-cultural-norms). The explanations are original and specific to Pacewise; they are not an official statement of Uber.*
