# Pacewise — Research README

> एक पेज जो Pacewise frontend पर हुई पूरी working conversation का रिकॉर्ड रखता है: क्या माँगा गया, क्या बना, क्या गलत हुआ, क्या सीखा, और क्यों।
> Project owner (Harsh) के लिए लिखा गया। Scope: `speed-reader` Next.js app, उसकी public notes site (QR code), documents site, और quiz system।

**यह कितना पूरा है:** इस फ़ाइल के लिखे जाने से पहले conversation का शुरुआती हिस्सा compact कर दिया गया था, इसलिए वे शुरुआती items conversation summary से दर्ज किए गए हैं (*summary* से चिह्नित), जबकि doc-page के काम से आगे की हर चीज़ असली exchanges और code से दर्ज की गई है (*direct* से चिह्नित)। यहाँ कुछ भी गैप भरने के लिए गढ़ा नहीं गया है; जहाँ कोई detail पता नहीं है, वहाँ यही लिखा है।

---

## 1. एक paragraph में Project

**Pacewise** एक speed-reading और comprehension trainer है: चुनी हुई pace पर कहानी पढ़ें, quiz दें, results और analytics पाएँ, history, streaks और daily-consistency calendar रखें, अपनी stories (text, PDF, images) upload करें और उन्हें edit करें। यह **Next.js 14 (App Router) + TypeScript (strict) + Tailwind** frontend है, जिसमें जानबूझकर object-oriented, per-user storage layer है, 100 demo accounts वाला development login है, और (इस दौर में नया) एक **public, बिना login वाली notes और documents site** है जो हर user के QR code को scan करके खुलती है।

Design language ("the homepage language") जिसे हर नई screen को follow करना है: tight tracking वाले `font-display` headings, `rounded-[32px]` surfaces, brand blue `#306fdb`, floating-label fields, Apple जैसी सादगी (glass navbar, pill buttons, खुली spacing)।

---

## 2. Owner के बनाए Working rules (और वे क्यों मायने रखते हैं)

| Rule | हर round में नतीजा |
| --- | --- |
| "Do not change anything else" | हर बदलाव additive और scoped है; shared components को optional props से extend किया जाता है, कभी rewrite नहीं। |
| हर जगह homepage design language follow करें | नया UI tokens (`bg-canvas`, `bg-canvas-raised`, `text-ink`, `text-ink-muted`, `border-overlay/10`), 32px radii, display type को reuse करता है। |
| Docs हमेशा updated रहें | `docs/QUIZ_AND_PROFILE.md` चालू feature document है; नए features उसमें जोड़े जाते हैं। |
| Zip के रूप में deliver करें | हर round के बाद `speed-reader-frontend.zip` (`node_modules`, `.next` छोड़कर)। |
| English/Hinglish में लिखते हैं | Replies छोटे, सादे और सीधे रहते हैं। |
| Assistant काम को owner के browser में नहीं चलाता | Assistant tests, syntax checks और isolated rendering से verify करता है; real-browser confirmation owner की होती है। |

---

## 3. Requests की Timeline (क्या माँगा गया, क्रम से)

### 3.1 पहले का दौर (*summary*)
1. "Change photo" action की जगह **QR code** लगाएँ; profile में **Notes** tab जोड़ें (CN, OS, OOP, DBMS: Pacewise में हर एक कैसे इस्तेमाल होता है, tradeoffs के साथ)।
2. **गलत PDF owner ठीक करें** (upload किया गया PDF किसी और को उसका owner दिखा रहा था)।
3. QR link को **Vercel home address** खोलने वाला बनाएँ ("pick home address for qr code link")।
4. **Analytics / Apple-style restyles**: results page की typography, graph container widths, Efficiency / Dashboard / History restyle, mobile responsiveness, audience images।
5. **Result-page और quiz upgrades** (छह screenshots): Accuracy और Pace graphs के लिए standard widths; Apple-style pause button हटाना; "Time per question" list, lazy loading के साथ (एक बार में 10); सही **total test time** ("Begin quiz" से Done/Finish तक); history में हर test **कब** शुरू हुआ दिखाना; quiz button में green stroke, white background और liquid effect; Apple जैसी progress-bar sound; calendar के किसी दिन पर hover करने पर reading **और** test time दिखना; उसी design language में sign-in/sign-up page।
6. **Strategic सवाल**: 2.5 Cr-package profile के लिए software की relevance "अगर backend, monitoring और best engineering practices integrate हों", साथ में PDF-editor जैसा feature, 10 में से rating; फिर "micro-level" security, distributed-systems सोच, YouTube-scale architecture, और **test/revision notifier** के लिए algorithm design। (Chat में जवाब दिया गया; उस जवाब का research-grade version §7 और `docs/research/01-…` में है।)
7. **Deployment confusion**: एक Vercel deployment URL "Ready" दिखा रहा था पर update नहीं दिखा रहा था, जबकि main domain दिखा रहा था; owner ने updated link की सटीक location और data flow पूछा।
8. **QR से public notes**: QR scan करने पर notes **बिना login** दिखें, हर doc एक web page हो, landing page जैसा navbar हो, वही hamburger menu बिना personal data के हो, और menu में हर docs folder हो।

### 3.2 यह दौर (*direct*)
9. **Doc-page upgrade** (सिर्फ़ docs pages): OOP class diagram GitHub के Mermaid viewer की तरह चले (pan arrows, zoom, reset, expand, copy, drag); navbar scroll-down पर छिपे और scroll-up पर लौटे; hamburger menu में नया **Research** section; code boxes में बड़ा text; highlighter + typography tools।
10. Docs navbar में **Search bar** (Uiverse design) जोड़ा गया, फिर navbar में **centre** किया गया।
11. **Diagram और code की सटीक rendering**: diagram GitHub की image से match करे (orthogonal edges, सही arrows); हर code sample colour-highlighted हो और indentation बनी रहे, तथा यह दिखे कि code **कहाँ** रहता है (file path) और वह **कौन सा principle** दिखाता है।
12. **Quiz JSON compatibility**: GATE CS1 2026 question file (65 questions) को quiz ने reject कर दिया। साथ ही: docs search पूरे page content में खोजे (सिर्फ़ folder names में नहीं); docs से select-and-highlight feature हटाएँ।
13. **Quiz extras**: questions के अंदर का code indentation के साथ code की तरह दिखे; search bar dark mode support करे; quiz schema optional **chapter**, **topic**, **year of appearance** (previous-year question) और **test के बाद दिखने वाला note** स्वीकार करे।
14. Notes/docs pages पर **Hydration error** (दो बार report हुआ; पहला fix गलत था)।
15. **यह document।**

---

## 4. क्या बना (area के अनुसार)

### 4.1 Per-user session layer (OOP, *summary* + code reviewed)
- `UserScopedRepository<T>` (abstract, Template Method): base class key बनाना, defensive JSON parsing, खाली value पर fallback और लिखना संभालती है; subclasses `feature()`, `emptyValue()` और optional `deserialize()` देती हैं।
- `ListRepository<TItem>` (abstract, दूसरा और आख़िरी level): array-valued features (`HistoryRepository`, `BookmarkRepository`, `AchievementRepository`, `CustomStoryRepository`, `SearchHistoryRepository`)।
- `StreakRepository`, `DailyActivityRepository` (object/map values)।
- `UserNamespace` (value object, private constructor + `forUser`): वह इकलौती जगह जो key format `srt:v2:u:<id>:<feature>` जानती है।
- `KeyValueStore` interface, `BrowserKeyValueStore` और `MemoryKeyValueStore` के साथ (Dependency Inversion; tests memory store इस्तेमाल करते हैं)।
- `UserSession` (aggregate/facade, composition): हर feature के लिए एक repository, सभी construction के समय एक namespace से bound; `clearAllData()` सबको polymorphically clear करता है।
- `SessionManager` (registry + observer), `IdentityProvider` / `DevStoreIdentityProvider`, `LegacyDataMigrator`, `ScopedTokenStore`।
- पूरी explanation और class diagram: `docs/OOP_ARCHITECTURE.md`।

### 4.2 Quiz और results (*summary* + direct)
- Timing: "Begin quiz" पर `quizStartedAt`, Done/Finish पर `quizFinishedAt`; हर question का **dwell time** दोबारा देखने पर भी जुड़ता है; results में total test time, average से अलग दिखता है।
- Daily activity में `testMs` जुड़ा, ताकि consistency calendar के hover में reading time **और** test time दिखे।
- Results page: Time-per-question list, "Show 10 more / Show less" के साथ।
- **नए question kinds** (direct): *select-all-that-apply* (`correctAnswer: [1,3]`) और *typed number* (`options: []`, numeric answer; whole numbers exact, decimals ±0.01 जब तक `tolerance` न दिया गया हो)। Grading `lib/grading.ts` (`questionKind`, `isAnswered`, `isCorrectAnswer`) में है, जिसे quiz, results और timing list इस्तेमाल करते हैं।
- **Questions में code** (direct): `lib/questionText.ts` question को prose और code में बाँटता है (Markdown fences, या code जैसी दिखने वाली lines के runs); `components/Quiz/QuestionText.tsx` code को indentation, colours और horizontal scroll के साथ दिखाता है; multi-line options भी code की तरह render होते हैं।
- **Optional labels** (direct): `chapter`, `topic`, `year` (aliases `pyqYear`, `yearOfAppearance`), `note`। Chapter/topic/year question के ऊपर chips के रूप में दिखते हैं; note results page पर दिखता है। कोई भी required नहीं है; गलत format का year report किया जाता है, चुपचाप ठीक नहीं किया जाता।
- Sample और tests: `scripts/fixtures/gate-cs1-2026.json`, `scripts/quiz.test.ts`।

### 4.3 Public notes और documents site (*summary* + direct)
- Routes `/notes/<userId>` और `/notes/<userId>/docs/<slug>` login gate और app navbar को bypass करते हैं (`lib/publicRoutes.ts`, `isPublicPath`)।
- Documents **build time पर** bundle होते हैं (`scripts/build-docs.mjs` → `lib/docs/generated.ts`, client menus के लिए सिर्फ़ titles वाला `index.generated.ts`, और search के लिए `search.generated.ts`), इसलिए यह Vercel पर बिना runtime file access के चलता है। Credentials CSV को जानबूझकर bundle **नहीं** किया गया।
- एक dependency-free Markdown→HTML renderer (`lib/docs/markdown.ts`) पहले सब कुछ escape करता है, फिर सिर्फ़ अपने tags emit करता है; links docs के बीच resolve होते हैं; headings को anchors मिलते हैं; fences captioned code blocks या diagram holders बन जाते हैं।
- Hamburger menu: Notes, Documents (हर folder expandable), एक अलग **Research** section, और "Open Pacewise"।
- Navbar scroll-down पर छिपता है और scroll-up पर लौटता है (सिर्फ़ documents में)।
- QR links हमेशा production domain `https://pacewise-delta.vercel.app` इस्तेमाल करते हैं (`NEXT_PUBLIC_SITE_URL` से override करें); QR encoder एक custom implementation (`lib/qr.ts`) है जिसे decoding से verify किया गया।

### 4.4 Doc pages पर Diagrams और code (direct)
- `components/Notes/MermaidViewer.tsx`: pan के लिए drag, arrow pad, zoom in/out (Ctrl/⌘ + scroll), reset (fit), full-screen expand, source copy; site theme को follow करता है; rendering fail होने पर source text पर fallback करता है।
- Mermaid और **ELK layout** CDN से on demand load होते हैं, जिससे GitHub जैसा look आता है (orthogonal edges, line hops)।
- `lib/docs/highlight.ts`: ts/js/c/bash/json/css/nginx/yaml के लिए छोटा tokenizer; fenced blocks ` title="path/to/file.ts" principle="…" ` रख सकते हैं, जो caption bar (path + language + Copy) और "Principle" footer के रूप में दिखता है। बड़े ASCII trees plain रहते हैं पर बड़े size में।
- Full-text search (`components/Notes/DocSearch.tsx`): हर section का index; results में document › section और highlighted snippet दिखता है और section पर jump होता है; सिर्फ़ पहली बार इस्तेमाल पर load होता है; centred pill जो hover/focus पर चौड़ी होती है और site theme को follow करती है।

---

## 5. Challenges और findings (problem → cause → fix → lesson)

| # | Problem | Root cause (finding) | Fix | Lesson |
| --- | --- | --- | --- | --- |
| 1 | लंबे links (version 7+) के लिए QR code decode नहीं हुआ | "Reserved modules" check ने **alignment patterns** भी skip कर दिए (सिर्फ़ finder-overlap positions skip होनी चाहिए) | Reserved-area logic ठीक किया; OpenCV से decode करके verify किया | Encoders को आँख से नहीं, decode करके verify करें |
| 2 | एक PDF किसी दूसरे user का दिख रहा था | बड़े PDFs **localStorage quota** से ज़्यादा हो जाते हैं; write **चुपचाप** fail हुआ, और ownership record उसी write में था, इसलिए खो गया; फिर app signed-in user पर fallback कर गया | Ownership को एक छोटी अलग list (`customStoryClaims`) में ले जाया गया; `SessionManager.findCustomStoryOwner` पहले उसे check करता है; test जोड़ा गया | Ownership को बड़े content वाले write में कभी न रखें; storage failures को first-class मानें |
| 3 | Vercel deployment URL में update नहीं दिखा, पर domain में दिखा | हर deployment का *उस build* के लिए अपना permanent URL होता है; production domain सबसे नए **promoted** production deployment की ओर इशारा करता है; deployment URLs protected भी हो सकते हैं | Production domain share करें (और QR links में उसी को इस्तेमाल करें) | Deployment URL = per-build preview; domain = जो users देखते हैं |
| 4 | Lightweight type-check में type errors | Wrapper components ने `className/style/children` declare नहीं किए थे; `notFound()` का return typing | Props स्पष्ट रूप से declare किए; `notFound()` के बाद `return null` जोड़ा | Wrappers पर explicit prop types |
| 5 | Doc diagram, diagram की जगह raw source दिखा रहा था | Viewer ने `mermaid` npm package import किया, जो owner की machine पर install नहीं था; error पकड़ लिया गया और fallback source दिखाया गया | Mermaid + ELK को CDN से on demand load किया (install की ज़रूरत नहीं) | किसी feature को ऐसे install step पर निर्भर न बनाएँ जो user ने शायद चलाया ही न हो |
| 6 | Diagram GitHub से अलग दिखा (curved, उलझे edges) | Default layout dagre है जिसमें curved edges होते हैं; GitHub की picture **ELK** orthogonal routing इस्तेमाल करती है | `@mermaid-js/layout-elk` register किया और `layout: "elk"` इस्तेमाल किया (fail होने पर dagre पर fallback); locally reproduce करके screenshot से compare किया | याददाश्त से नहीं, reference image से compare करें |
| 7 | Search bar ने dark mode को ignore किया | Pill ने Tailwind `dark:` variants इस्तेमाल किए, पर यह app theme **`<html>` पर `data-theme`** से बदलता है, `dark` class से नहीं | `:root[data-theme="dark"]` rules से style किया | App की अपनी theming mechanism से match करें |
| 8 | Quiz ने GATE JSON reject किया | Importer सिर्फ़ single-choice समझता था (≥2 options और एक numeric index चाहिए था); file में array answers और खाली-option वाले typed-number questions हैं | दोनों question kinds को end-to-end जोड़ा (import, quiz UI, grading, results, editor, export) | पहले असली file parse करें; schema असली data से design करें |
| 9 | Hydration error "Text content does not match server-rendered HTML" (पहला fix गलत था) | दो causes। (a) "Shared by …" नाम browser storage से आता था, जिसे server नहीं देख सकता (पहले यही ठीक किया गया)। (b) **असली, लगातार रहने वाला cause:** `"` characters वाले inline `<style>{css}</style>` blocks — React का server renderer `<style>` के अंदर के text को HTML-escape करता है (`"` → `&quot;`) पर browsers `<style>` में entities decode नहीं करते, इसलिए server और client का text अलग था | तीनों style blocks (doc content, search, quiz code) में CSS को `dangerouslySetInnerHTML` से डाला | React में quotes/`<`/`&` वाली CSS को कभी `<style>` children के रूप में न रखें; और जब कोई fix error न हटाए, तो दूसरा cause खोजें |
| 10 | Highlighting tools माँगे गए, फिर हटाए गए | Feature का scope बदल गया | Toolbar, saved marks और author highlight styling हटाई; annotation engine delete किया | Feature के साथ dead code भी हटाएँ |

---

## 6. मुख्य insights (छोटी list)

1. **Isolation structural होनी चाहिए, procedural नहीं।** Per-user data इसलिए safe है कि repository सिर्फ़ एक `UserNamespace` के साथ बन सकती है, इसलिए नहीं कि हर call site को user id पास करना याद रहता है।
2. **Storage चुपचाप fail होती है।** localStorage quota errors, private-mode access errors और SSR में `window` का न होना; हर read/write को defensive path चाहिए, और critical metadata को bulky data के साथ एक write में नहीं रखना चाहिए।
3. **Server और client को byte-identical पहला HTML render करना चाहिए।** Browser storage, time, randomness या locale से आने वाली कोई भी चीज़ mount के बाद पढ़ी जानी चाहिए; quotes वाला inline `<style>` text एक जाल है।
4. **Public pages को अलग trust model चाहिए।** QR notes site कोई personal data नहीं दिखाती, login bypass करती है, docs build time पर bundle करती है, और demo-credentials CSV को जानबूझकर बाहर रखती है।
5. **असली input से design करें।** GATE file ने दो question kinds दिखाए जो schema में नहीं थे; schema को असली data का superset होना चाहिए, नए fields optional और aliases tolerated।
6. **Reference से measurement करके match करें।** Diagram fidelity (ELK बनाम dagre) और QR validity (decode test) को reproduce और compare करके तय किया गया, अनुमान से नहीं।
7. **Features को setup steps पर निर्भर न बनाएँ।** CDN loading ने "npm install चलाओ" वाली failure mode हटा दी।
8. **App की अपनी mechanisms इस्तेमाल करें।** Theme `data-theme` से, tokens CSS variables से, surfaces `rounded-[32px]` से — नया UI पुराने से अलग नहीं दिखना चाहिए।
9. **Additive change ही "don't change anything else" का पालन है।** Optional props, optional JSON fields, नई files — पुराना behaviour अछूता रहता है और tests इसे साबित करते हैं (editor 55, session 23, presence 8, docs 8, quiz 8)।
10. **Principle का नाम वहीं लिखें जहाँ code रहता है।** जो documentation `path` + principle (Template Method, Composition, Value Object…) की ओर इशारा करती है, वह verifiable है: reader file खोलकर देख सकता है।

---

## 7. Research notes (`docs/research/` के research notes का सार)

### 7.1 Scaling, security, और revision notifier
- State को browser से बाहर जाना चाहिए: हर user के लिए एक API के पीछे एक source of truth; progress write-heavy है (user के हिसाब से partition करें), stories और notes read-heavy हैं (CDN + cache)।
- सस्ती security जो ज़्यादातर incidents रोकती है: hashed passwords, short-lived tokens, हर query पर per-user authorisation, login और upload पर rate limits, हर boundary पर validation; uploads signed URLs से सीधे object storage में जाते हैं, server सिर्फ़ metadata + owner id रखता है।
- Monitoring: structured logs, request metrics (latency, errors), अकेली failures पर नहीं बल्कि error **rate** पर alerts।
- **Notifier (spaced repetition):** हर test के बाद score के हिसाब से अगला review schedule करें — 50% से कम पर अगले दिन; 50–80% पर 3 दिन में; 80% से ऊपर पर 7 दिन में, हर बार दोगुना — और एक scheduler जो हर user को प्रति दिन अधिकतम एक reminder भेजे।
- Decision: अभी client-side design रखें; backend जोड़ते समय **पहले state, फिर uploads, फिर reminders** ले जाएँ।
- मूल चर्चा का context (*summary*): backend, monitoring और engineering best practices जोड़ने पर 2.5 Cr-package profile के लिए relevance, YouTube-scale सोच, और notifier के लिए algorithm design। ईमानदार framing: दिखाया गया *engineering judgement* (isolation, defensive storage, tests, documentation) कच्चे scale claims से ज़्यादा मायने रखता है।

### 7.2 Uploaded PDF ownership bug — §5 #2 देखें।
### 7.3 Vercel deployments बनाम domain — §5 #3 देखें।

---

## 8. Intentions — इसे किस स्तर पर बनाया जा रहा है

| Level | Intention | Codebase में सबूत |
| --- | --- | --- |
| **Product** | एक polished, Apple-grade reading trainer जिसका design हर screen पर consistent हो | Design tokens, 32px surfaces, हर जगह reuse हुई homepage typography |
| **Engineering craft** | पठनीय, सिद्धांतों पर आधारित OOP, SOLID और named patterns के साथ, हर एक file से linked | `docs/OOP_ARCHITECTURE.md`, captioned code samples के साथ |
| **Quality** | Behaviour tests से साबित हो, सिर्फ़ दावा नहीं | पाँच suites में 102 automated tests |
| **Reliability** | Fail soft: quota errors, SSR, private mode, missing CDN | Defensive repositories; diagram fallback; guarded storage |
| **Security & privacy** | Construction से isolation; public pages में personal data नहीं; secrets bundle नहीं | `UserNamespace`, public-route design, CSV excluded |
| **Portfolio / career** | Senior full-stack roles के लिए दिखाने लायक system: QR से पहुँचने वाली documentation site, architecture write-ups, research notes | Notes site, docs site, research section |
| **Future scale** | Client-only से backend तक साफ़ रास्ता (state → uploads → reminders), monitoring और spaced-repetition notifier के साथ | §7.1 |
| **Extensibility** | बिना code बदले कोई भी block-level diagram या नया quiz field जोड़ें | ` ```mermaid ` blocks; optional quiz schema |

---

## 9. नए authoring features कैसे इस्तेमाल करें (quick reference)

**Documents (`docs/**/*.md`)**
- Diagram: language `mermaid` वाला fenced block interactive viewer बन जाता है।
- Context के साथ code: ` ```ts title="lib/session/UserSession.ts" principle="Composition over inheritance" `।
- अन्य writing tools: `++underline++`, `~~strike~~`, `***bold italic***`। (`==text==` अब plain text के रूप में दिखता है।)
- नया folder = नया menu group; `research` नाम का folder **Research** के नीचे दिखता है।
- Docs edit करने के बाद `node scripts/build-docs.mjs` चलाएँ (यह `predev`/`prebuild` पर भी चलता है)।

**Quiz JSON**
```json
{
  "question": "…\n(code may be included with \\n and indentation, or in a ``` fence)",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": 1,
  "explanation": "Why.",
  "chapter": "Operating Systems",
  "topic": "Deadlock",
  "year": 2026,
  "note": "Shown after the test."
}
```
- Select-all: `"correctAnswer": [0, 2]`। Typed number: `"options": []`, `"correctAnswer": 4.25` (optionally `"tolerance"`)।
- `chapter`, `topic`, `year`, `note` सभी optional हैं।

---

## 10. ज्ञात सीमाएँ और ईमानदार caveats
- Assistant ने app को owner के browser में नहीं चलाया है; हर browser-level behaviour (drag/zoom का feel, scroll-hide navbar, search dropdown, hydration) सिर्फ़ तर्क, isolated rendering और tests से verify हुआ है।
- Diagrams को internet access (CDN) चाहिए। Offline या CSP-restricted deployments में source text दिखेगा; Mermaid को locally bundle करना विकल्प है।
- Plain-text questions में code detection heuristic है; line breaks के बिना एक-line code prose ही रहता है। निश्चितता के लिए fences इस्तेमाल करें।
- Docs search titles, headings और body text देखती है, पर यह साधारण word-match है (typo tolerance नहीं, और title > heading > body से आगे कोई ranking नहीं)।
- Public documents लिंक रखने वाले किसी के लिए भी public हैं: `docs/` में secrets न रखें।
- QR से share किए गए notes में owner का नाम तभी दिखता है जब देखने वाले browser में वह user locally stored हो।
- Dev overlay Next.js 14.2.5 को outdated बताता है; upgrade करना एक अलग task है।

---

## 11. References

**Framework और web platform**
- Next.js — Text content does not match server-rendered HTML (hydration errors): https://nextjs.org/docs/messages/react-hydration-error
- Next.js App Router documentation: https://nextjs.org/docs/app
- React — `hydrateRoot` और hydration mismatches: https://react.dev/reference/react-dom/client/hydrateRoot
- React — `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
- MDN — Web Storage API और quota behaviour: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- MDN — `<style>` element (raw text content): https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style
- Tailwind CSS — dark mode (class बनाम media strategies): https://tailwindcss.com/docs/dark-mode
- Vercel — Deployments और domains: https://vercel.com/docs/deployments/overview और https://vercel.com/docs/projects/domains

**Diagrams**
- Mermaid documentation (class diagrams, configuration): https://mermaid.js.org/
- Mermaid layouts (ELK): https://mermaid.js.org/config/layouts.html
- Eclipse Layout Kernel (ELK): https://eclipse.dev/elk/
- GitHub — Creating diagrams (Markdown में Mermaid): https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams

**QR codes**
- ISO/IEC 18004 (QR code symbology) और मुफ़्त summary https://www.qrcode.com/en/about/standards.html पर
- Reed–Solomon error correction (background): https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction

**Object-oriented design**
- Gamma, Helm, Johnson, Vlissides — *Design Patterns* (Template Method, Observer, Facade, Registry-style access)
- Robert C. Martin — SOLID principles (Single responsibility, Open/closed, Liskov, Interface segregation, Dependency inversion)
- Eric Evans — *Domain-Driven Design* (Value Object, Aggregate Root)
- Project documents: `docs/OOP_ARCHITECTURE.md`, `docs/QUIZ_AND_PROFILE.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION_CHECKLIST.md`

**Learning science और revision scheduling**
- Ebbinghaus — forgetting curve: https://en.wikipedia.org/wiki/Forgetting_curve
- Wozniak — SM-2 spaced-repetition algorithm: https://super-memory.com/english/ol/sm2.htm
- Roediger & Karpicke (2006) — test-enhanced learning (retrieval practice से retention बेहतर होता है)

**Security और distributed systems**
- OWASP Cheat Sheet Series (authentication, session management, file upload): https://cheatsheetseries.owasp.org/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Kleppmann — *Designing Data-Intensive Applications* (partitioning, caching, queues, monitoring)
- Google SRE Book — monitoring distributed systems (symptoms और error rates पर alert): https://sre.google/sre-book/monitoring-distributed-systems/

**Case studies और saved posts (docs site में embedded)**
- Apple AirTag case study — LinkedIn post: https://www.linkedin.com/feed/update/urn:li:share:7520840668794118144 (Research › Apple AirTag case study)
- 10 algorithms behind system design — LinkedIn post: https://www.linkedin.com/feed/update/urn:li:share:7521638052172288001 (Syllabus › Insights)
- System design post — LinkedIn: https://www.linkedin.com/feed/update/urn:li:share:7514296223722467328 (Syllabus › System Design)
- 8 hidden system design problems — Shalini Goyal: https://lnkd.in/p/g35wJwn2 (Syllabus › Challenges)

- System design posts 1–3 — LinkedIn: https://www.linkedin.com/feed/update/urn:li:share:7519179549264343041 , https://www.linkedin.com/feed/update/urn:li:share:7518813190181343233 , https://www.linkedin.com/feed/update/urn:li:share:7518811245807005696 (System design folder)

**Quiz content**
- Owner द्वारा दिया गया GATE CS1 2026 question set (65 questions), `scripts/fixtures/gate-cs1-2026.json` के रूप में रखा गया।

---

## 12. Verification record (असल में क्या चलाया गया)
- `npm test`: editor 55, session 23, presence 8, docs 8, quiz 8 — आख़िरी run में सब passing।
- Docs renderer: escaping, link safety, tables, nested lists, fences, diagram holders, anchors, captioned code (indentation बनी रही, tokens, principle)।
- Quiz: पूरी GATE file बिना किसी issue के import होती है; multi-select exact-set grading; numeric tolerance; optional labels; उस file के questions 27, 34 और 39 पर code-in-question splitting verified।
- Headless Chromium में rendering checks: dark theme में ELK के साथ OOP diagram GitHub reference से match हुआ; captioned code block colours, indentation, path, language और principle footer के साथ render हुआ।
- हर `.ts/.tsx/.css` पर syntax checks (esbuild); छुई गई library files पर strict `tsc`।
- Assistant द्वारा **verify नहीं** किया गया: owner के browser के अंदर का behaviour और live Vercel deployment।

---

*End of document.*
