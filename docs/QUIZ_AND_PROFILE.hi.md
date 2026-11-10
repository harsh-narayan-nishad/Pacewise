# Quiz tracker, quiz-only mode और profile tabs

## Quiz page (`app/questions/page.tsx`)
- दो columns: बाईं ओर question और दाईं ओर `components/Quiz/QuestionTracker.tsx` (छोटी screens पर ये ऊपर-नीचे stack हो जाते हैं)।
- Tracker = `components/ui/AnimatedList.tsx` (React Bits), जिसे `style` prop के ज़रिए app tokens से theme किया गया है, इसलिए यह dark/light/sepia को follow करता है।
- हर question का status इनमें से एक दिखता है: **Completed**, **Marked for review**, **Skipped** या **Not answered**; header में "X of N completed" दिखता है।
- Rows में question का text दिखता है। List के नीचे तीन गोल हरे buttons उसे filter करते हैं: Completed / Marked for review / Not completed (दोबारा click करने पर filter हट जाता है; हर button पर count दिखता है)। किसी row पर click करने से उस question पर जा सकते हैं। Quiz आख़िरी question पर **Finish** से पूरा होता है। Panel borderless, translucent और blurred है, और page पर home page जैसी ही inertial scrolling है।
- "Begin quiz" अब चुने गए question count को dispatch करता है (`GO_TO_QUESTIONS`), और `quizOnly` को बनाए रखता है।

## Quiz only (बिना reading के)
- Story hero में "Quiz only" button → `GO_TO_QUESTIONS { quizOnly: true }`।
- Results को `wpm: 0` वाली history entry के रूप में save किया जाता है (speed chart से बाहर रहती है); कोई reading session नहीं बनता; ResultCard reading/speed वाली rows छिपा देता है।

## Profile tabs (सिर्फ़ अपनी profile पर)
- Dashboard / Reading history / Analytics / Past test attempts / Settings अब "Content posted by you" की जगह content area को बदल देते हैं; वापस जाने के लिए active pill पर दोबारा click करें।
- Content `components/Account/*Panel.tsx` में है; पुराने routes (`/history`, `/reading-history`, `/analytics`, `/settings`) वही panels reuse करते हैं और उनका look वैसा ही रहता है।
- दूसरे users की profiles पर अब भी सिर्फ़ posts दिखते हैं।

Note: AnimatedList के demo icon imports (hugeicons) हटा दिए गए हैं; browser में verify नहीं किया गया (sandbox में build उपलब्ध नहीं था)।

## Analytics layout (apple.com से प्रेरित)
- Reading speed / Accuracy: दो बड़े rounded cards अगल-बगल (mobile पर stacked), जिनमें बीच में title, एक trend line, brand blue में average और नीचे graph है।
- Consistency (streaks / active days / reading time) और Daily pace: बाईं ओर aligned display heading और दाईं ओर blue note, दो-line caption वाला एक बड़ा card, और फिर dots + गोल play button का एक pill (`components/Analytics/PagerPill.tsx`)। Dots stats में आगे बढ़ाते हैं (या pace के लिए latest days में); play auto-advance करता है, और reduced-motion वाले users के लिए paused से शुरू होता है।
- Data, calculations और tooltips में कोई बदलाव नहीं है।
- Efficiency, Dashboard, Reading history और Past test attempts वही rounded-[32px] card language इस्तेमाल करते हैं (blue notes, display headings, Efficiency पर pager)।

## Notes, QR code और public link
- नया **Notes** tab (Dashboard और Reading history के बीच): इसमें बताया गया है कि इस project में CN, OS, OOP और DBMS कैसे इस्तेमाल हुए हैं, हर एक के साथ "Used here" और "Tradeoff" line है। Content `lib/notesContent.ts` में है; एक ही view (`components/Notes/NotesView.tsx`) tab और public page दोनों को serve करता है।
- अपनी profile पर QR code (`components/Profile/ProfileQr.tsx`) ने Change photo button की जगह ले ली है; photo बदलने के लिए अपने avatar पर click करें। QR signed-in user की id से बनता है (`lib/qr.ts`, कोई dependency नहीं, decode करके test किया गया), इसलिए हर user को अलग QR मिलता है। उसके नीचे "Copy notes link" है।
- QR `/notes/<userId>` खोलता है, जिसके लिए अब बाकी हर page की तरह sign-in ज़रूरी है (`DevLoginGate`); इसका अपना header है और app navbar नहीं है (`lib/publicRoutes.ts`)। Link हमेशा deployed app की ओर जाता है; override करने के लिए `NEXT_PUBLIC_SITE_URL` set करें; default `lib/publicRoutes.ts` (`SITE_ORIGIN`) में deployed Vercel address है, इसलिए locally चलाने पर भी QR phone से काम करता है।

## Uploaded-PDF owner fix
PDF के pages images होते हैं, इसलिए बड़ी PDF ~5 MB के browser storage quota से ज़्यादा हो सकती है; save चुपचाप fail हो जाता था और फिर story ऐसी दिखती थी जैसे किसी और की हो। `CustomStoryRepository` अब uploader की id एक छोटी अलग list (`customStoryClaims`) में भी रखता है, और `SessionManager.findCustomStoryOwner` उसे check करता है। Test: `scripts/session-isolation.test.ts`। जो PDF store करने के लिहाज़ से बहुत बड़ी हो, वह session के लिए तो खुलती है पर library में नहीं रखी जाती।

## Test timing (start से finish तक)
- `ReadingContext` में `quizStartedAt` (जो "Begin quiz" दबाने पर `GO_TO_QUESTIONS` से set होता है) और `quizFinishedAt` (जो `GO_TO_RESULTS` से set होता है) store होते हैं। **Total test time = finish - start**, जो results page, quiz panel (live) और history में दिखता है।
- हर question का time उस question पर की गई हर visit का योग है (`app/questions/page.tsx` में `flushDwell`), इसलिए दोबारा देखे गए और unanswered questions भी गिने जाते हैं।
- History entries में `quizStartedAt` होता है; "Past test attempts" में "Started 10:42 AM · took 12:03" दिखता है।
- हर finished test अपनी duration उस दिन के `testMs` में जोड़ता है (`DailyActivityRepository.recordTestTime`); consistency tracker का hover card total reading time और total test time दिखाता है, और सिर्फ़ test वाला दिन भी active गिना जाता है।
- Quiz बीच में छोड़कर निकलने पर कुछ record नहीं होता (क्योंकि जोड़ने के लिए कोई result नहीं होता)।

## Results page और visual system
- Results site की width (`max-w-6xl`) और apple.com home-page वाला tile grid इस्तेमाल करते हैं: एक score tile (rating, copy, दो pills, सारे numbers), फिर Reading speed और Accuracy tiles अगल-बगल (`TrendTiles`), Time per question (एक बार में 10 rows, "Show 10 more" / "Show less"), efficiency, और बाकी analytics। Analytics page भी यही width इस्तेमाल करता है (`PageShell wide`)।
- Showcase cards के नीचे का pager सिर्फ़ dots का है (play/pause नहीं, auto-advance नहीं)।
- Hover cards एक ही style share करते हैं (`lib/chartStyle.ts`)।
- Quiz panel: progress को liquid-glass container (`components/ui/LiquidGlass.tsx`, navbar का `GlassSurface`) के अंदर macOS volume HUD जैसा दिखाया गया है, साथ में अलग live "Total test time" और हरे strokes वाले सफ़ेद गोल filter buttons हैं।
- Sign-in / sign-up screens बाकी app जैसा ही card, display heading, underlined fields और pill tabs इस्तेमाल करती हैं। Behaviour में कोई बदलाव नहीं है।

## Public notes site (QR code) - documents को web pages के रूप में
- `/notes/<userId>` (sign in करने के बाद) पहले notes और फिर इस `docs/` folder का हर document दिखाता है; `/notes/<userId>/docs/<slug>` एक document को web page के रूप में दिखाता है। Documents के बीच के links काम करते हैं, और `#section` links headings पर jump करते हैं।
- Page पर landing navbar है (glass bar, बाईं ओर hamburger और नाम, दाईं ओर theme switch)। Hamburger में कोई personal data नहीं है (कोई playlists, search history, uploads या sign-out नहीं); उसमें notes और हर docs folder की एक row (**Project docs**, **Interview prep**) listed है। Folder खोलने पर उसके documents की list दिखती है; जो पढ़ा जा रहा है वह highlighted रहता है।
- यह कैसे काम करता है: `scripts/build-docs.mjs` `docs/**/*.md` को `lib/docs/generated.ts` (पूरा text, सिर्फ़ server के लिए) और `lib/docs/index.generated.ts` (सिर्फ़ titles, menu इस्तेमाल करता है) में bundle करता है। यह `dev` और `build` से पहले अपने आप चलता है, इसलिए नए या edit किए गए docs बिना किसी अतिरिक्त step के दिख जाते हैं; हाथ से refresh करने के लिए `npm run docs:build` चलाएँ। `lib/docs/markdown.ts` Markdown को escaped HTML में बदलता है (tests: `npm run test:docs`)।
- सिर्फ़ `.md` files publish होती हैं। Non-markdown files कभी publish नहीं होतीं। `docs/*.md` file में आप जो भी लिखते हैं वह QR link के ज़रिए public हो जाता है, इसलिए secrets इन files से बाहर रखें।

## Document pages (public notes)

- Mermaid blocks के रूप में लिखे **Diagrams** interactive हैं: drag करके pan, arrow pad, zoom in/out (Ctrl/⌘ + scroll), reset, full screen में expand, और source copy। इसके लिए `mermaid` package चाहिए (`npm install`)।
- Document pages पर **Navbar** नीचे scroll करने पर छिप जाता है और ऊपर की ओर किसी भी scroll पर लौट आता है।
- **Research** का hamburger menu में अपना section है, जो `docs/research/*.md` से भरता है।
- Authors के लिए **Writing tools**: `++underline++`, `~~strike~~`, `***bold italic***`। (`==text==` स्वीकार होता है पर plain text की तरह दिखता है; document pages पर readers के पास select करके highlight करने का tool नहीं है।)
- Code blocks में बड़ा font इस्तेमाल होता है।
- **Search** public navbar के बीच में: एक pill जो hover/focus पर चौड़ा हो जाता है; यह pages के सारे text (titles, headings, body, code) में खोजता है, match को highlight करके एक snippet दिखाता है और वह section खोल देता है; Enter पहला result खोलता है। Index `scripts/build-docs.mjs` द्वारा `lib/docs/search.generated.ts` में generate होता है और सिर्फ़ search इस्तेमाल होने पर load होता है।
- **Diagrams** अब Mermaid + ELK layout को CDN से load करते हैं (`npm install` की ज़रूरत नहीं) और GitHub के viewer की तरह draw होते हैं (orthogonal arrows)।
- **Code blocks** syntax-coloured हैं और indentation बनी रहती है। ऊपर file path और उसके नीचे principle दिखाने के लिए ` ```ts title="path/to/file.ts" principle="What principle it shows" ` लिखें। कोई भी ` ```mermaid ` block interactive diagram बन जाता है, इसलिए नए block diagrams इसी तरह जोड़े जा सकते हैं।
- Search bar navbar के बीच में है।

## Question types (quiz JSON)

Single-choice के अलावा, quiz JSON में ये भी हो सकते हैं:

- **Select all that apply** — `"correctAnswer": [0, 2]` (indexes, letters या option texts)। तभी सही माना जाता है जब ठीक वही set चुना जाए।
- **Typed number** — `"options": []` और `"correctAnswer": 4.25`। पूर्ण संख्याएँ ठीक-ठीक match होनी चाहिए; decimals ±0.01 के भीतर स्वीकार होते हैं (बदलने के लिए `"tolerance"` set करें)।

Quiz में checkboxes या **Check answer** button वाला number box दिखता है (question छोड़ने पर जो दर्ज किया गया है वह submit हो जाता है), और results, timing और accuracy वही grading इस्तेमाल करते हैं (`lib/grading.ts`)। एक sample `scripts/fixtures/gate-cs1-2026.json` में है; tests `scripts/quiz.test.ts` में हैं।

## Quiz JSON: optional labels और questions में code

- हर question में ये **optional** fields भी हो सकते हैं (कोई भी ज़रूरी नहीं): `chapter`, `topic`, `year` (वह साल जिसमें पिछले साल का question आया था, जैसे `2026`; `pyqYear` के रूप में भी स्वीकार होता है) और `note` (test के बाद results page पर दिखता है)। Quiz देते समय chapter, topic और year question के ऊपर छोटे chips के रूप में दिखते हैं। One-by-one editor में भी इनके लिए optional boxes हैं।
- Question में **Code** एक code block के रूप में दिखता है, जिसमें indentation और line breaks बने रहते हैं और syntax colours होते हैं। इसे JSON में `\n` line breaks (और indentation के लिए spaces) के साथ लिखें, या string के अंदर Markdown fence में लपेट दें (```` ```c … ``` ````)। Pasted code lines वाले plain-text questions अपने आप detect हो जाते हैं। कई lines में फैले options भी code की तरह दिखाए जाते हैं।

## Syllabus section, layering और quiz schema panel

- **Syllabus**: एक menu section (Research के नीचे) जो `docs/syllabus/*.md` से भरता है: chapter 1 *Pacewise* (sub-systems A–T और कठिन engineering areas) और chapters 2–8 के placeholders; `docs/syllabus/README.md` index है।
- **Doc pages पर layering** (ऊपर से नीचे): menu drawer (z 110) → उसका backdrop (100) → navbar और उसका search dropdown (95) → full-screen diagram (90, navbar के नीचे बैठता है) → page content।
- **Quiz schema panel**: question uploader (जो Add story, Edit story और PDF questions dialog में साझा है) का JSON / file tab हर स्वीकृत field, उसका type, वह required है या नहीं, और एक पूरा example list करता है।

## Syllabus में System design notes

Syllabus chapters में अब ये हैं: *System Design* (latency vs throughput vs bandwidth एक 3-column table में, cheatsheet image और उसके 8 sections 3 columns में), *Insights* (system-design boxes के अंदर 10 algorithms), *Challenges* (8 छिपी समस्याएँ, post link और image)। Docs में `![caption](/docs/file.png)` से local images embed की जा सकती हैं (files `public/docs/` में); tables में cells के अंदर line breaks के लिए `<br>` चलता है।
- **Embeds**: अपनी ही line पर `::linkedin urn:li:share:<id> <height> "title"` एक LinkedIn post embed करता है (सिर्फ़ LinkedIn के embed URLs संभव हैं)। इसे Syllabus › Insights, Syllabus › System Design और Research › Apple AirTag case study में इस्तेमाल किया गया है।
- **System design folder** (`docs/system-design/`): इसका अपना menu group है जिसमें तीन embedded LinkedIn posts हैं।

## HTML & CSS interview page

`docs/interview/13-html-css.md` जोड़ा गया (Interview prep)। Code blocks के caption `index.html` / `styles.css` हैं, exact indentation बनी रहती है, और HTML/XML/SVG को अब `lib/docs/highlight.ts` में syntax colouring मिलती है।

## Search engine system design

`docs/syllabus/06-system-design.md` में section 3 "Pacewise Search Engine" जोड़ा गया, जिसमें `public/docs/search-*.svg` में पाँच SVG diagrams, capacity estimates, docs/PDFs/images (OCR) की ingestion, tenant-routed index, query flow, ranking और failure modes हैं।

## Cleanup

Insights और Challenges खाली कर दिए गए (placeholders), Syllabus "System Design 1" हटा दिया गया, और तीन Case studies posts तथा बाकी saved LinkedIn posts अब एक ही page, `docs/system-design/social-media.md`, पर हैं।

## Time analysis

Profile → Time spent, story-page speed wheel, overtime clock, hero Prev/Next, opening-glitch fix और docs footer का वर्णन `docs/TIME_ANALYSIS.md` और `docs/STORY_PAGE.md` में है।

## Docs pages: path, inertia, rail

हर docs page reading time के ऊपर और footer के ठीक ऊपर दोबारा अपना path दिखाता है (Folder > Tab > Page, हर level एक link); page reading page जैसी ही eased inertia scrolling इस्तेमाल करता है; bar-line rail footer को overlap करने के बजाय उसके साथ ऊपर चढ़ जाती है; search results एक full-width, borderless panel के रूप में खुलते हैं जिसके नीचे बाकी screen blurred रहती है।

## Leadership principles

`docs/leadership-principles/` एक नया Documents folder है जिसमें एक sub-folder `amazon/` ("Amazon's Leadership") है: एक overview page और 16 principles में से हर एक के लिए interview-prep का एक page। Menu parent के अंदर sub-folder को list करता है।

## Leadership principles folder

`docs/leadership-principles/` (Documents menu) जोड़ा गया, जिसमें sub-folders `amazon/` और `google/` हैं: headings हर company की published list को follow करते हैं और हर explanation मौलिक है, जो Pacewise के लिए लिखी गई है।

## DAA notes और code अलग files में

`docs/daa-notes/` में Design and Analysis of Algorithms के notes हैं (overview, पाँच units, quick revision sheet)। यह docs menu में Documents के नीचे "DAA notes" के रूप में दिखता है।

- **C++ page के बाहर रहता है।** Programs `docs/daa-notes/cpp/NAME.cpp` में हैं और उनका असली output `NAME.out.txt` में। Page एक अकेली line से उसे ले आता है: `::include cpp/NAME.cpp` (और output के लिए `::include cpp/NAME.out.txt`)।
- **Build के समय** `scripts/build-docs.mjs` हर ऐसी line को एक सामान्य code block से बदल देता है (file path title के रूप में, colours, Copy button; output files "Output" block बन जाती हैं)। कोई missing file, `docs/` के बाहर का path, या code fence वाली file build को एक message के साथ रोक देती है।
- **Program जोड़ने के लिए:** `docs/daa-notes/cpp/my-program.cpp` save करें, फिर जहाँ वह दिखना चाहिए वहाँ `::include cpp/my-program.cpp` रखें।
- **Renderer में छोटे बदलाव:** text में `<sub>` और `<sup>` की अनुमति है (n<sub>2</sub>), और `++`, `==`, `~~` किसी शब्द के बाद आने पर अब format नहीं होते, इसलिए `C++`, `i++` और `a==b` जैसे लिखे हैं वैसे ही रहते हैं।
