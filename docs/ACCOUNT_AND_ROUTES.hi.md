# Account, routes और story ownership

## Routes (`lib/routes.ts` ही single source of truth है)
| URL | Page |
|---|---|
| `/` | Search landing (या story page अगर कोई story loaded है) |
| `/story/[id]` | किसी story का अपना page — refresh-safe और shareable; story cards यहीं link करते हैं |
| `/dashboard`, `/profile/[userId]` | Home dashboard, public profile |
| `/reading-history` | पढ़ी गई हर story, तारीख के अनुसार grouped, paginated |
| `/analytics` | Speed / comprehension charts |
| `/history` | पिछले test attempts (hamburger menu में भी) |
| `/settings` | Theme, reading font, reading speed |

Navbar: reading-mode toggle और story-title link हटा दिए गए; profile menu की rows असली routes हैं।

## Story ownership
Upload की गई story उस user की होती है जिसकी personal library में वह है।
`SessionManager.findCustomStoryOwner(id)` उस user को ढूँढता है; `getContentAuthorId` पहले इसी से पूछता है
(`registerCustomStoryOwnerResolver` के ज़रिए, जो `lib/session/composition.ts` में जुड़ा है) और सिर्फ़ built-in stories के लिए
demo mapping पर वापस जाता है। Resolver inject किया जाता है ताकि `contentMeta` कभी session
layer को import न करे (जो उस store पर निर्भर है जो `contentMeta` को import करता है — वरना cycle बन जाएगा)। Test: `npm test`।

## Profile photo
`lib/avatar.ts` 256px JPEG में centre-crop करता है; `devDataStore.setAvatar/getAvatar` इसे persist करते हैं (सिर्फ़ अपनी photo)।
`components/ui/Avatar.tsx` photo → initial → icon दिखाता है; navbar, profile menu और profile page में इस्तेमाल होता है।
Upload/remove: profile menu या profile page (`useAvatarUpload`)।

## Edit story
`EditStoryModal` Add-story modal के हिस्सों (`StoryFormParts`, `StoryCoverPicker`, `QuestionsInput`,
rich editor) को दोबारा इस्तेमाल करता है ताकि दोनों बिल्कुल एक जैसे दिखें। बदले/हटाए गए cover videos सिर्फ़ तब delete होते हैं जब edit save किया जाए।

## Navbar layout और audience section
- Navbar: बायाँ = hamburger menu + company name; दायाँ = notifications, dark-mode switch (`ThemeSwitch`), profile। बीच का slot अब भी search box / reading timer रखता है।
- Landing का "For every ambitious mind." एक Apple-style carousel है (`components/Landing/AudienceMarquee.tsx`): लंबे dark cards, नीचे bold शुरुआत वाला caption, नीचे दाईं ओर previous/next buttons, scroll-snap और touch swipe।

## Profile button, logout, carousel
- Navbar का profile button सीधे आपका profile page खोलता है (कोई dropdown नहीं)। Dashboard / Reading history / Analytics / Past test attempts / Settings आपके अपने profile page पर quick links हैं; **Log out** hamburger menu के सबसे नीचे है।
- Landing story carousel: पारदर्शी glass covers दो खड़ी guide lines के बाहर (arrows के नीचे) हैं; हर card का arrow button `/reader` पर auto-scroll reading शुरू करता है (`StoryCard arrowStartsReader`), card पर बाकी सब कुछ वैसा ही है।
