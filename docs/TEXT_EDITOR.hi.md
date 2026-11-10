# Story text editor — design, OOP, CN, OS और DBMS

यह document उस rich text editor को cover करता है जिसने **Add your own story** और **Edit story** में सादे `<textarea>` की जगह ली। सिर्फ़ text box बदला है। Guided form fields, question editor, **JSON tab**, reading engine, design system और per-user session layer अछूते हैं।

नीचे जो कुछ भी लिखा है वह इस repo में मौजूद code का वर्णन है। Section 9 बताता है कि क्या *नहीं* हुआ है, इसलिए यहाँ की किसी बात को उससे आगे का दावा न समझें।

---

## 1. User को क्या मिलता है

| क्षेत्र | Implemented |
|---|---|
| Text | bold, italic, underline, strike, sub/superscript, font family (कोई भी नाम, suggestions के साथ), font size (कोई भी px value), font colour और highlight (palette, हाल के colours, HEX / `rgb()` / `hsl()` entry, reset), clear formatting |
| Blocks | Title, Subtitle, Heading 1–6, Quote, alignment (left/centre/right/justify), bullet, numbered (Tab/Shift+Tab से nesting), checklists (clickable), indent/outdent, line spacing, space before/after, paragraph background |
| Insert | links (Ctrl+K, scheme allow-list), images, tables, code blocks, horizontal rule, page break, symbols, equations (LaTeX-lite → Unicode), footnotes |
| Code blocks | हर block के लिए एक असली code-editor widget (देखें §4.3): 17 languages जिनमें JS/TS/Python/Java/C/C++/C#/Go/Rust/PHP/HTML/CSS/JSON/SQL/Bash/Markdown शामिल हैं, highlighting, auto-indent/dedent, bracket/quote pairing, Tab/Shift+Tab, Ctrl+/ comment, line numbers, current-line highlight, find/replace, wrap, visible whitespace, indent width 2/4/tab, dark/light code theme, copy, clear, delete, "convert selection to code block", ```` ```js ```` + Enter shortcut |
| Images | file picker, drag & drop, paste; ≤1600 px तक downscale; corner-handle resize (Shift = free aspect); left/centre/right; S/M/L; alt text; caption; border; spacing; replace; crop 1:1 / 4:3 / 16:9; delete |
| Tables | R×C insert; rows और columns add/delete; merge right/down; split; cell colour; borders toggle; Tab cells के बीच जाता है (आख़िर में एक row जोड़ता है) |
| Review / View | find & replace (match case, highlight), word / character / paragraph / code-block counts, reading time, document properties; continuous या page view, zoom 50–200 %, outline navigation, paper size, orientation, margins, header/footer text, page background, तीन paper themes |
| Fullscreen | Expand button, F11, बाहर निकलने के लिए Esc; caret, selection, scroll और unsaved edits बचे रहते हैं (§5.2) |
| Documents | inline title rename, autosave status, Save (Ctrl+S) / Save as copy / New / Open / Delete, crash recovery, `.txt .md .html .json` import, `.docx .md .html .txt` export, browser print dialog से PDF |

Keyboard: Ctrl+Z / Ctrl+Y (अपनी history), Ctrl+B/I/U, Ctrl+K, Ctrl+F, Ctrl+S, F11, Tab / Shift+Tab।

---

## 2. यह मौजूदा app में कैसे जुड़ता है

```
AddStoryModal / EditStoryModal
        │  <StoryTextEditor draftSlot onChange initial>      components/Editor/StoryTextEditor.tsx
        │        builds DocumentStore from sessionManager.active().namespace
        ▼
EditorView (React shell: ribbon, status bar, menus)          components/Editor/EditorView.tsx
        │
EditorSurface (contenteditable + history + paste/drop)       components/Editor/engine/*
        │  getHtml() → RichDocument.withHtml() → sanitize
        ▼
RichDocument (immutable)  ──►  Blocks (typed model)  ──►  exporters / stats / reading text
        │
DocumentStore ──► KeyValueStore + UserNamespace  (existing session layer, not modified)
```

* `storyBridge.ts` story और editor के बीच एकमात्र adapter है। Save पर story अपना सामान्य `story: [{ paragraph }]` रखती है (reading engine अपरिवर्तित है) और उसमें एक optional `richDocument` snapshot जुड़ जाता है। अगर plain paragraphs कहीं और edit किए जाएँ (उदाहरण के लिए JSON tab में) तो snapshot अब मेल नहीं खाता और अनदेखा कर दिया जाता है, इसलिए reader जो दिखाता है वही हमेशा source of truth होता है।
* JSON tab अपरिवर्तित है। JSON paste करना अब भी `addCustomStory` से गुज़रता है, और JSON में `richDocument` को बाकी सब की तरह untrusted input माना जाता है।
* Sessions: `lib/session` में कुछ edit नहीं किया गया। `DocumentStore` active user का `UserNamespace` उधार लेता है, इसलिए key construction की वजह से किसी दूसरे user के documents तक पहुँचा ही नहीं जा सकता। User switch होने पर `SessionBoundary` tree को दोबारा mount करता है, इसलिए नए user के लिए store फिर से बनता है।

---

## 3. File map

```
lib/editor/
  html/      entities, HtmlNode, HtmlParser, HtmlSerializer, SanitizePolicy, HtmlSanitizer
  model/     Blocks (Block hierarchy + BlockVisitor), BlockExtractor, RichDocument
  export/    Exporter (interface), TextExporters (txt/md/html), DocxExporter, ZipWriter, ExporterRegistry
  import/    Importers (txt, md, html) + ImporterRegistry
  code/      Tokenizer, languages, CodeEditingEngine
  persistence/ DocumentStore, ImageStore logic (inside DocumentStore), AutosaveScheduler, EditLock, EditorPrefs
  format/    TexLite
  util/      LruCache, crc32, hash
  storyBridge.ts
components/Editor/
  StoryTextEditor.tsx (composition root)  EditorView.tsx (React shell)  editor.css
  engine/  EditorSurface, CodeBlockWidget, ImageResizer, TableOps, commands, HistoryStack,
           SelectionMemento, FullscreenController
  ui/      Ribbon, ColorPopover, icons
scripts/editor.test.ts   (40 tests, `npm run test:editor`)
```

`lib/editor` में React और DOM की कोई dependency नहीं है (यह tests में Node के नीचे चलता है); `components/Editor` ही अकेली layer है जो browser को छूती है।

---

## 4. OOP — कहाँ और क्यों

### 4.1 Document model (`lib/editor/model`)

| Concept | कहाँ | क्यों |
|---|---|---|
| **Abstraction + inheritance** | `abstract class Block` जिसके साथ `ParagraphBlock`, `HeadingBlock`, `ListBlock`, `CodeBlock`, `ImageBlock`, `TableBlock`, `RuleBlock`, `PageBreakBlock`, `FootnotesBlock` | हर तरह के content के लिए एक contract (`kind`, `accept`, `isEmpty`) |
| **Immutability / value objects** | हर block field `readonly` है; `InlineRun` एक value है; `RichDocument.withHtml/withMeta/withPage` नए instances लौटाते हैं | undo history, autosave diffing और React state कभी आधे-बदले object को नहीं देख सकते |
| **Visitor (double dispatch)** | `BlockVisitor<R>` जिसे `PlainTextVisitor`, `MarkdownVisitor`, `DocxVisitor`, `StatsVisitor`, `PlainParagraphVisitor` implement करते हैं | format-specific व्यवहार blocks के बाहर रहता है। नया export format एक नया visitor है और किसी block class में बदलाव नहीं होता (**Open/Closed**) |
| **Encapsulation** | `RichDocument` में private constructor और static factories (`fromHtml`, `fromSnapshot`, `empty`) हैं। `fromHtml` हमेशा sanitize करता है | unsanitized HTML रखने वाला document बनाना असंभव है |
| **Single responsibility** | `BlockExtractor` ही अकेला code है जो HTML structure को समझता है; sanitizer सिर्फ़ filter करता है; serializer सिर्फ़ print करता है | "nested lists कैसे पढ़ी जाती हैं" का fix एक ही बार किया जाता है |
| **Lazy cached derivation** | `RichDocument.blocks` और `.stats` | हर immutable instance के लिए एक बार compute होते हैं |

### 4.2 Pipeline objects

* `HtmlSanitizer(parser, serializer, stylePolicy)` अपने collaborators constructor से लेता है (**Dependency Inversion**), इसलिए एक सख़्त policy inject की जा सकती है।
* `StylePolicy` और `SanitizePolicy.ts` allow-list को data और एक छोटे object के रूप में व्यक्त करते हैं।
* `DocumentExporter` / `DocumentImporter` **Strategy** interfaces हैं; `ExporterRegistry` / `ImporterRegistry` उन्हें रखती हैं (**Open/Closed**, **Liskov**: हर exporter बदला जा सकता है)।
* `ListNumbering` numbering rule को एक बार अपने पास रखता है और text व Markdown visitors में साझा होता है।

### 4.3 Editing layer (`components/Editor/engine`)

| Concept | कहाँ |
|---|---|
| **Command** | `EditorCommand`, `ExecCommand`, `FnCommand`, `CommandRegistry`। Ribbon buttons, shortcuts और tests सब `registry.run(id)` कॉल करते हैं |
| **Memento** | `HistoryStack` (सीमित snapshot history) और `SelectionMemento` (caret focus खोने और fullscreen के बाद भी बचा रहता है) |
| **Facade** | `EditorSurface` contenteditable की अजीबताओं को `setHtml / getHtml / exec / insertImageFile / find…` के पीछे छिपाता है; React सिर्फ़ इसी से बात करता है |
| **Adapter** | `CodeBlockWidget` एक `<textarea>` + highlight overlay को editor के अनुरूप ढालता है। Editing के *नियम* DOM-free `CodeEditingEngine` में हैं, इसलिए CodeMirror adapter सिर्फ़ widget की जगह ले सकता है |
| **Data-driven polymorphism** | 17 lexers के बजाय हर language के लिए एक `LanguageSpec` object से चलने वाली एक `Tokenizer` class |
| **Pure functions as strategy** | `CodeEditingEngine.tab/enter/type/backspace/toggleComment` state लेते हैं और नई state लौटाते हैं, इसलिए इन्हें बिना DOM के test किया जाता है |
| **State machine encapsulation** | `FullscreenController` (idle → native-fullscreen या fallback → exit) और `ImageResizer` (pointer drag) अपना lifecycle खुद संभालते हैं और अपने listeners को `dispose()` करते हैं |
| **Static utility class** | `TableOps` हर operation से पहले एक *grid* बनाता है (एक spanning cell कई slots घेरता है) |

### 4.4 Persistence

`DocumentStore`, `EditorPrefsRepository`, `EditLock`, `AutosaveScheduler<T>` (generic), `LruCache<K,V>` (generic) छोटी single-purpose classes हैं जिन्हें `StoryTextEditor.tsx` में compose किया जाता है, जो इस feature की composition root है, `lib/session/composition.ts` जैसी ही शैली में।

---

## 5. OS concepts (जैसे implement किए गए)

### 5.1 Scheduling, buffering, write coalescing
* `AutosaveScheduler` एक **debounced write-back buffer** है: keystrokes की एक बौछार आख़िरी keystroke के 800 ms बाद एक write बन जाती है, जैसे OS page-cache write-back। `flush()` `pagehide` और `visibilitychange → hidden` पर और unmount पर चलता है, ताकि आख़िरी keystrokes खो न जाएँ।
* भारी काम timers से टाला जाता है: document sync 180 ms पर trailing-throttled है, history 450 ms की शांति के बाद record होती है, resize handles pointer events और `ResizeObserver` इस्तेमाल करते हैं।

### 5.2 Resources, limits, memory
* History सीमित है (150 snapshots); `LruCache` (8 entries) हाल में खोले गए bodies रखता है; images store करने से पहले ≤ 1600 px तक downscale होती हैं; 12 MB से बड़ी images refuse की जाती हैं; storage quota की failures crash करने के बजाय `StorageFullError` उठाती हैं।
* Fullscreen controller पहले Fullscreen API का इस्तेमाल करता है **बिना DOM हिलाए**। अगर वह denied हो, तो root node को `<body>` के नीचे re-parent किया जाता है (transformed modal के अंदर का `position: fixed` element viewport को नहीं ढकेगा) और selection memento से restore हो जाती है।

### 5.3 Synchronisation और mutual exclusion
* `EditLock` एक **lease lock** है: holder हर `lease/3` पर एक timestamp renew करता है; crash हुए tab की lease expire हो जाती है, इसलिए lock deadlock नहीं हो सकता। दूसरा tab document को read-only खोलता है। Write के बाद वह दोबारा पढ़ता है ताकि race करने वाले writer का पता चले। (यह `localStorage` पर cooperative locking है, kernel mutex नहीं।)
* `DocumentStore.save` optimistic versions भी इस्तेमाल करता है (देखें §7), इसलिए lock के बिना भी एक पुराना tab `VersionConflictError` पाता है।

### 5.4 Process/lifecycle
* Page lifecycle hooks (`pagehide`, `visibilitychange`) ठीक वैसे इस्तेमाल होते हैं जैसे OS shutdown hooks इस्तेमाल करता है।
* हर लंबे समय तक जीने वाले object में `dispose()` है (listeners, observers, locks)।

---

## 6. CN (computer networks) concepts (जैसे implement किए गए)

Editor **डिज़ाइन से offline** है; यह कोई network request नहीं करता। Networking के जो विचार code में *हैं*:

| Concept | कहाँ |
|---|---|
| **Trust boundary पर untrusted input** | paste किया गया HTML, JSON से आया HTML, imported files और यहाँ तक कि `localStorage` भी parse और sanitize होते हैं (§8)। HTTP request body को validate करने जैसा ही रुख |
| **URL / scheme handling** | `isSafeUrl` scheme के अंदर के control characters हटाता है (`java\tscript:` को रोकता है), फिर links के लिए `http/https/mailto/tel` और images के लिए `http/https/data(image only)/sr-img` की अनुमति देता है। नए tab में खुलने वाले links को `rel="noopener noreferrer"` मिलता है |
| **Media types (MIME)** | image type allow-list (`png jpeg gif webp avif`), `data:` URL parsing (RFC 2397 base64), सही export MIME types (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/markdown;charset=utf-8`…) |
| **Content negotiation का समकक्ष** | paste `text/html` को प्राथमिकता देता है, `text/plain` पर fall back करता है, `Files` संभालता है — जैसे `Accept` list से कोई representation चुनना |
| **Error detection** | `crc32.ts` हर ZIP entry में इस्तेमाल होने वाला IEEE CRC-32 है (Ethernet के FCS वाला ही polynomial), जिसे standard test vector `123456789 → 0xCBF43926` के विरुद्ध जाँचा गया है |
| **Framing / binary container** | `ZipWriter` local headers, central directory और end-of-central-directory records byte-by-byte (little-endian) लिखता है |
| **Character encoding** | ZIP names और parts के लिए `TextEncoder` से UTF-8; names पर UTF-8 flag लगाया जाता है |
| **Content addressing / idempotency** | image की id उसके bytes का SHA-256 prefix है (`sr-img:<hash>`), इसलिए उसे दो बार store करना no-op है, content-addressed cache की तरह |
| **Download semantics** | `Blob` + object URL + `download` attribute, जो `Content-Disposition: attachment` का client-side समकक्ष है |

Implement नहीं: कोई sockets नहीं, documents के लिए कोई server sync नहीं, कोई retry/backoff नहीं (retry करने के लिए कुछ remote है ही नहीं)। Backend अब भी सिर्फ़ `paragraphs: string[]` स्वीकार करता है।

---

## 7. DBMS concepts (जैसे implement किए गए)

`DocumentStore` app के `KeyValueStore` (localStorage) के ऊपर एक छोटा per-user database है। यह SQL **नहीं** है और crash-proof ACID भी नहीं; यह उन विचारों को लागू करता है जो key-value माध्यम में फिट होते हैं।

**Logical schema (per user namespace `srt:v2:u:<user>:docs:…`)**

| Table (key) | Row | Notes |
|---|---|---|
| `index` | `{id PK, title, words, updatedAt, version, bytes}[]` | छोटा, अक्सर पढ़ा जाता है (Documents menu के लिए covering index) |
| `body:<id>` | `RichDocumentSnapshot` | बड़ा, खोलने पर पढ़ा जाता है। `index` से जानबूझकर अलग रखा गया (**normalisation / vertical partitioning**), ताकि listing कभी document bodies parse न करे |
| `img:<hash>` | data URL | **content-addressed**: स्वाभाविक de-duplication; bodies के साथ n:m |
| `draft:<slot>` | snapshot | write-ahead style recovery copy |
| `lock:<id>` | `{owner, until}` | lease row (§5.3) |
| `prefs` | editor UI preferences | |

**Mechanisms**
* **Primary key / uniqueness:** `newId()`; `save` id से replace करता है।
* **Rollback वाला transaction:** `save` पहले body फिर index लिखता है; अगर index write fail हो (quota) तो body अपनी पिछली value पर restore हो जाती है। Tested।
* **Optimistic concurrency:** हर row में `version` है; `save(id, doc, expected)` बदली होने पर `VersionConflictError` फेंकता है। Tested।
* **Referential integrity / GC:** `collectGarbage()` bodies और drafts में `sr-img:` references scan करता है और बिना reference वाली images delete कर देता है (scan से reference counting); `remove()` इसे कॉल करता है। Tested।
* **Consistency check (fsck):** `repair()` बिना body वाली index rows हटाता है। Tested।
* **Caching:** body reads के आगे `LruCache`।
* **Tenant isolation:** namespace prefix; test साबित करता है कि दूसरा user कुछ नहीं देखता (`documents are isolated per user`)।
* **Read पर integrity constraints:** stored snapshots दोबारा validate होते हैं (`fromSnapshot` margins को clamp करता है, enums को whitelist करता है) और दोबारा sanitize होते हैं; छेड़छाड़ की गई `localStorage` value script inject नहीं कर सकती (tested)।
* **Content का normal form:** documents sanitized HTML plus metadata के रूप में store होते हैं; typed `Block` model derived है (दो बार store नहीं), जिससे update anomalies से बचाव होता है।

सीमाएँ: `localStorage` प्रति origin ≈ 5 MB और synchronous है; browser के write के बीच में मर जाने पर multi-statement durability की कोई गारंटी नहीं है।

---

## 8. Security: sanitizer ही trust boundary है

HTML JSON tab, paste, imports, shared stories और storage से editor तक पहुँच सकता है। बाद में उसे `innerHTML` को assign किया जाता है, इसलिए `HtmlSanitizer` एक **white-list** है:

* अज्ञात tags unwrap कर दिए जाते हैं; `script style iframe object embed svg math form input …` अपनी content *के साथ* हटा दिए जाते हैं;
* attributes: सिर्फ़ per-tag allow-list plus `style/class/title/lang/dir` और `data-*` का एक तय सेट (कोई `on*` कभी नहीं बचता);
* classes को `sr-*` से मेल खाना चाहिए;
* CSS: per-property validators; `url(`, `expression(`, `javascript:`, `@import`, backslashes या `<>` वाली कोई भी value हटा दी जाती है;
* URLs: देखें §6; SVG data URLs reject होते हैं;
* 64 से गहरी nesting को text में समतल कर दिया जाता है (stack-exhaustion guard);
* परिणाम idempotent है (`sanitize(sanitize(x)) === sanitize(x)`, tested)।

Code blocks `<pre data-lang><code>text</code></pre>` के रूप में store होते हैं जिसमें text escaped होता है, और save पर textarea की value से दोबारा बनाए जाते हैं, इसलिए code save / reopen / export में बचा रहता है (tested, असली browser में भी)।

---

## 9. ईमानदार कमियाँ और trade-offs

1. **Monaco / CodeMirror नहीं।** Build environment में package registry पहुँच से बाहर थी, इसलिए code widget हाथ से लिखा गया है (highlighted `<pre>` के ऊपर textarea)। इसे ऐसे बनाया गया है कि CodeMirror 6 सिर्फ़ `CodeBlockWidget` की जगह ले सके।
2. **Code folding का कोई UI नहीं।** `CodeEditingEngine.foldRanges()` brace/indent ranges compute करता है (tested) पर widget fold markers नहीं दिखाता। **Autocomplete** implement नहीं है।
3. **Page view दृश्य है, असली pagination नहीं।** यह paper width, margins, page guide lines, header और footer एक बार दिखाता है। असली प्रति-page numbering और automatic page breaking सिर्फ़ exported `.docx` / print output में होते हैं।
4. **`document.execCommand`** (deprecated पर सर्वव्यापी) inline formatting करता है। Undo/redo editor की अपनी snapshot history है ताकि widget और table बदलाव सही तरह undo हों; undo के बाद caret restoration text offset से होती है।
5. **Find** एक ही text node के अंदर मिलान करता है, इसलिए bold/plain सीमाओं को लाँघने वाला hit छूट जाता है। Code blocks के अंदर Find widget के अपने bar से होता है (block में Ctrl+F)।
6. **Tables:** table-level border toggle और per-cell colour हैं, पर column-width dragging या per-cell border styles नहीं।
7. **Multilevel lists:** nesting काम करती है; editor browser के default markers दिखाता है, `.docx` गहराई के अनुसार decimal / letter / roman इस्तेमाल करता है।
8. **Equations** एक LaTeX-lite → Unicode renderer हैं, TeX engine नहीं।
9. **Footnotes** insertion पर numbered होते हैं और delete के बाद दोबारा renumber नहीं होते।
10. **Images** localStorage में store होती हैं (downscaled); कई बड़ी images quota से टकराएँगी (साफ़ error दिखाया जाता है)। centre aspect presets से आगे कोई cropping नहीं।
11. **DOCX/PDF import समर्थित नहीं।** Import: `.txt .md .html .json`। PDF export browser के print dialog का इस्तेमाल करता है।
12. **Backend:** standalone API सिर्फ़ `paragraphs: string[]` स्वीकार करता है, इसलिए rich snapshot device पर ही रहता है; backend को plain text ही मिलेगा।
13. **Verification:** logic `npm run test:editor` (40 tests, Node) से cover है और DOCX LibreOffice तथा python-docx में खोला गया। UI को headless Chromium में परखा गया (typing, undo, headings, code-block editing, table merge/split, image resize, fullscreen, find/replace, XSS paste, save/export)। इसे Firefox/Safari में test **नहीं** किया गया, और पूरा `next build` यहाँ नहीं चल सका (dependency install संभव नहीं था), इसलिए एक बार `npm install && npm run build` चलाएँ।

---

## 10. Tests चलाना

```bash
npm run test:editor    # model, sanitizer, exporters, code engine, store, lock, autosave
npm run test:session   # existing per-user session isolation (unchanged)
```

---

## 11. Reader support (images, tables, code) और quiz-question input

### 11.1 Reader अब वही दिखाता है जो आपने लिखा
`components/Reader/Reader.tsx` editor में लिखी गई story को flat paragraphs के बजाय उसके rich snapshot से render करता है, इसलिए **images, captions, tables, headings, lists, links और highlighted code blocks** reading view में दिखते हैं। बिना snapshot वाली stories (JSON stories, built-in stories) पहले की तरह ही render होती हैं।

* `StoryContentRenderer` (`lib/editor/reader/`) एक pure class है: sanitized HTML tree → `sr-img:` references resolve करना → `<pre>` को उसी `Tokenizer` से syntax-highlight करना जो editor इस्तेमाल करता है → neutral text/background colours हटाना → **दोबारा sanitize** करना → string। यह जो कुछ भी बनाता है उसमें ऐसा कोई tag, attribute, class, style या URL नहीं हो सकता जिसे allow-list मना करती है (एक hostile snapshot से tested)।
* `createStoreImageResolver` पहले active user के namespace में image खोजता है, फिर किसी दूसरे user की उसी content hash वाली row में (ताकि अपनाई गई story अपनी pictures रखे)। जो भी मिलता है उसे base64 raster data URL के रूप में दोबारा validate किया जाता है; छेड़छाड़ की गई value "Image unavailable" note बन जाती है, `javascript:`/SVG source कभी नहीं।
* Reader में काली/सफ़ेद/grey text colours हटा दी जाती हैं ताकि लेखक का चुना काला text dark theme पर गायब न हो जाए; रंगीन colours (red, blue …) रखे जाते हैं।
* Reading engine अछूता है: progress time-based है और scroll position live track height (`ResizeObserver`) से निकाली जाती है, इसलिए images जैसे लंबे content के लिए engine में बदलाव नहीं चाहिए। "paragraph x of N" label plain paragraphs गिनता है (code text और captions सहित)।
* Snapshot सिर्फ़ तब तक इस्तेमाल होता है जब तक वह `story.story` से मेल खाता है (`richDocFor`), इसलिए कहीं और edit किया गया text (जैसे JSON tab) ही हमेशा reader में दिखता है।
* **GC fix:** `DocumentStore.collectGarbage()` अब user का पूरा namespace scan करता है, saved stories सहित, इसलिए किसी story में इस्तेमाल हुई image कभी delete नहीं होती जब उसका editor draft या document हटाया जाए (tested)।

Images हर user के browser storage में रहती हैं; किसी दूसरे browser में कॉपी की गई story JSON अपनी images साथ नहीं ले जाती (वे "Image unavailable" दिखती हैं)।

### 11.2 Quiz questions जोड़ना: एक-एक करके **या** JSON / file से
`components/Search/QuestionsInput.tsx` **Add story** और **Edit story** दोनों में इस्तेमाल होता है (media stories अपना मौजूदा flow रखती हैं)। एक toggle इनके बीच बदलता है:

* **One by one** — question, options (add/remove), correct-answer radio, explanation, delete question।
* **JSON / file** — JSON type या paste करें, box पर `.json`/`.txt` file drop करें, या **Load file** इस्तेमाल करें; **Insert example** एक template देता है।

दोनों views एक ही list edit करते हैं, इसलिए आप 30 questions paste करके "One by one" पर जा सकते हैं और एक ठीक कर सकते हैं, फिर वापस आ सकते हैं; edits JSON में दिखते हैं। JSON pane live है: valid JSON तुरंत list को replace कर देता है; invalid JSON पिछली अच्छी list रखता है, question number के हिसाब से बताता है कि क्या गलत है, और ठीक होने तक **Add story** को disable करता है / **Save** को block करता है।

स्वीकृत JSON (`lib/questionImport.ts`, tested): एक array, `{ "questions": [...] }` (इसलिए पूरी story JSON भी चलती है), या एक अकेला question; वैकल्पिक रूप से ```json fence के अंदर। प्रति question: `question` (`q`, `text`), `options` (`choices`, `answers`; 2–12, कोई blank या duplicate नहीं), `correctAnswer` (`answer`, `correct`, `correctIndex`, `correctOption`) और `explanation` (`explain`, `rationale`)। Answer एक **0-based number**, एक **letter** (`"B"`) या **सटीक option text** हो सकता है; इसके अलावा कुछ भी report किया जाता है, अंदाज़ा कभी नहीं लगाया जाता। सीमाएँ: 200 questions, 1 MB file।

मौजूदा story validation अब भी text story के लिए कम से कम एक question माँगती है।

## 12. Reader में code: IDE-style formatting

हर code snippet अपनी अलग lines में, indentation बरकरार रखकर, highlighted, एक scrollable block में दिखता है (`white-space: pre`, 4-wide tabs, कोई ligatures नहीं, कोई inherited letter-spacing नहीं)।

- **Editor code blocks**: dedented, "plaintext" होने पर language का अंदाज़ा लगाया जाता है, और जिस code के line breaks खो गए हों (एक लंबी line) उसे `beautifyIfCollapsed` दोबारा flow करता है (brace languages और JSON; strings और comments को कभी नहीं छेड़ा जाता; जिस code में पहले से कई lines हों उसे कभी दोबारा नहीं लिखा जाता)।
- **बिना rich snapshot वाली stories** (JSON, PDF, पुराने saves): `plainStoryToHtml` ``` fences और ऐसे multi-line paragraphs खोजता है जो code जैसे दिखें (`looksLikeCode`, एक रूढ़िवादी line-scoring heuristic) और उन्हें उसी तरह render करता है। दूसरा multi-line prose अपने line breaks रखता है। जिन stories में code नहीं है वे मूल plain layout रखती हैं।
- Code `lib/editor/code/CodeHeuristics.ts`, `lib/editor/reader/CodeFormatter.ts`, `lib/editor/reader/plainStoryHtml.ts` में है; 6 tests इसे cover करते हैं।


## 13. One-click "Format code"

हर code block में एक `{ }` button है (और block के अंदर **Shift+Alt+F**) जो पूरे block को उसकी language में format करता है। अगर block plain text है, तो पहले language का अंदाज़ा लगाया जाता है और block उसी पर switch हो जाता है। Ctrl+Z format को undo करता है।

`lib/editor/code/formatCode.ts` (Strategy pattern, हर language family के लिए एक strategy):
- **JSON**: parse करके pretty-print (invalid JSON bracket indentation पर fall back करता है)।
- **HTML**: tag-depth layout; `<script>` / `<style>` bodies JS / CSS की तरह format होते हैं; `<pre>` / `<textarea>` अछूते रहते हैं।
- **Python**: indentation levels दोबारा निकाले जाते हैं और चुने गए indent के साथ दोबारा लिखे जाते हैं (tabs और मिली-जुली widths ठीक होती हैं)। Lines कभी जोड़ी या तोड़ी नहीं जातीं, क्योंकि indentation ही Python का अर्थ है।
- **SQL**: keywords upper-case, प्रति clause एक line, प्रति column एक line, `AND`/`OR` indented।
- **Bash**: `if/fi`, `do/done`, `case/esac`, `{ }` blocks।
- **JS, TS, Java, C, C++, C#, Go, Rust, PHP, CSS** और बाकी सब: bracket depth से re-indent; एक collapsed line को पहले statements में तोड़ा जाता है।
- Strings और comments कभी नहीं बदले जाते (language Tokenizer तय करता है)। Formatting idempotent है, और किसी भी internal error पर मूल code रखा जाता है। Block की indent setting (2 / 4 / tab) इस्तेमाल होती है।

साथ ही ठीक किया गया: Tokenizer में unterminated-string/comment matching multiline flag के साथ `$` इस्तेमाल करती थी, जो triple-quoted strings को पहली line पर ख़त्म कर देता था; Python की `'''` strings अब पहचानी जाती हैं।

### 13.1 वह code जिसके line breaks खो गए

**✦ Format** button language selector के ठीक बगल में है। एक line के रूप में paste या save किया गया code आमतौर पर पुरानी indentation को 2+ spaces की एक कतार के रूप में रखता है, जहाँ हर newline था। `splitOnWideGaps` उन gaps को वापस line breaks में बदल देता है (`;`, `{`, `}` के बाद और `//` comment के बाद; साथ ही `;}`), strings के अंदर कभी नहीं, और फिर नतीजे को दोबारा indent किया जाता है। अगर block "Plain text" है और C-family code जैसा दिखता है (typed declarations, generics, braces), तो उसे Java के रूप में पहचाना जाता है। Reader एक-line वाले code के लिए यही logic इस्तेमाल करता है।
