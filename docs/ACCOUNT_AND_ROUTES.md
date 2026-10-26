# Account, routes & story ownership

## Routes (`lib/routes.ts` is the single source of truth)
| URL | Page |
|---|---|
| `/` | Search landing (or the story page if a story is loaded) |
| `/story/[id]` | A story's own page — refresh-safe and shareable; story cards link here |
| `/dashboard`, `/profile/[userId]` | Home dashboard, public profile |
| `/reading-history` | Every story read, grouped by date, paginated |
| `/analytics` | Speed / comprehension charts |
| `/history` | Past test attempts (also in the hamburger menu) |
| `/settings` | Theme, reading font, reading speed |

Navbar: the reading-mode toggle and the story-title link were removed; the profile menu rows are real routes.

## Story ownership
An uploaded story belongs to the user whose personal library holds it.
`SessionManager.findCustomStoryOwner(id)` finds that user; `getContentAuthorId` asks it first (via
`registerCustomStoryOwnerResolver`, wired in `lib/session/composition.ts`) and only falls back to the
demo mapping for built-in stories. The resolver is injected so `contentMeta` never imports the session
layer (which depends on the store that imports `contentMeta` — a cycle otherwise). Test: `npm test`.

## Profile photo
`lib/avatar.ts` centre-crops to 256px JPEG; `devDataStore.setAvatar/getAvatar` persist it (own photo only).
`components/ui/Avatar.tsx` shows photo → initial → icon; used in the navbar, profile menu and profile page.
Upload/remove: profile menu or profile page (`useAvatarUpload`).

## Edit story
`EditStoryModal` reuses the Add-story modal parts (`StoryFormParts`, `StoryCoverPicker`, `QuestionsInput`,
rich editor) so both look identical. Replaced/removed cover videos are deleted only when the edit is saved.

## Navbar layout & audience section
- Navbar: left = hamburger menu + company name; right = notifications, dark-mode switch (`ThemeSwitch`), profile. The centre slot still hosts the search box / reading timer.
- Landing "For every ambitious mind." is an Apple-style carousel (`components/Landing/AudienceMarquee.tsx`): tall dark cards, caption below with a bold lead, previous/next buttons bottom-right, scroll-snap and touch swipe.

## Profile button, logout, carousel
- The navbar profile button opens your profile page directly (no dropdown). Dashboard / Reading history / Analytics / Past test attempts / Settings are quick links on your own profile page; **Log out** is at the bottom of the hamburger menu.
- Landing story carousel: translucent glass covers sit outside the two vertical guide lines (under the arrows); each card's arrow button starts auto-scroll reading at `/reader` (`StoryCard arrowStartsReader`), everything else on the card is unchanged.
