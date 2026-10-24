# Story text editor — design, OOP, CN, OS and DBMS

This document covers the rich text editor that replaced the plain `<textarea>` in
**Add your own story** and **Edit story**. Only the text box changed. The guided form
fields, the question editor, the **JSON tab**, the reading engine, the design system
and the per-user session layer are untouched.

Everything below describes code that exists in this repo. Section 9 lists what is
*not* done, so nothing here should be read as a claim beyond it.

---

## 1. What the user gets

| Area | Implemented |
|---|---|
| Text | bold, italic, underline, strike, sub/superscript, font family (any name, with suggestions), font size (any px value), font colour and highlight (palette, recent colours, HEX / `rgb()` / `hsl()` entry, reset), clear formatting |
| Blocks | Title, Subtitle, Heading 1–6, Quote, alignment (left/centre/right/justify), bullet, numbered (nesting via Tab/Shift+Tab), checklists (clickable), indent/outdent, line spacing, space before/after, paragraph background |
| Insert | links (Ctrl+K, scheme allow-list), images, tables, code blocks, horizontal rule, page break, symbols, equations (LaTeX-lite → Unicode), footnotes |
| Code blocks | a real code-editor widget per block (see §4.3): 17 languages incl. JS/TS/Python/Java/C/C++/C#/Go/Rust/PHP/HTML/CSS/JSON/SQL/Bash/Markdown, highlighting, auto-indent/dedent, bracket/quote pairing, Tab/Shift+Tab, Ctrl+/ comment, line numbers, current-line highlight, find/replace, wrap, visible whitespace, indent width 2/4/tab, dark/light code theme, copy, clear, delete, "convert selection to code block", ```` ```js ```` + Enter shortcut |
| Images | file picker, drag & drop, paste; downscaled to ≤1600 px; corner-handle resize (Shift = free aspect); left/centre/right; S/M/L; alt text; caption; border; spacing; replace; crop 1:1 / 4:3 / 16:9; delete |
| Tables | insert R×C; add/delete rows and columns; merge right/down; split; cell colour; borders toggle; Tab moves between cells (adds a row at the end) |
| Review / View | find & replace (match case, highlight), word / character / paragraph / code-block counts, reading time, document properties; continuous or page view, zoom 50–200 %, outline navigation, paper size, orientation, margins, header/footer text, page background, three paper themes |
| Fullscreen | Expand button, F11, Esc to exit; caret, selection, scroll and unsaved edits survive (§5.2) |
| Documents | title rename inline, autosave status, Save (Ctrl+S) / Save as copy / New / Open / Delete, crash recovery, import `.txt .md .html .json`, export `.docx .md .html .txt`, PDF through the browser print dialog |

Keyboard: Ctrl+Z / Ctrl+Y (own history), Ctrl+B/I/U, Ctrl+K, Ctrl+F, Ctrl+S, F11, Tab / Shift+Tab.

---

## 2. How it plugs into the existing app

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

* `storyBridge.ts` is the only adapter between a story and the editor. On save the
  story keeps its normal `story: [{ paragraph }]` (the reading engine is unchanged)
  and gains an optional `richDocument` snapshot. If the plain paragraphs are edited
  elsewhere (for example in the JSON tab) the snapshot no longer matches and is
  ignored, so what the reader shows is always the source of truth.
* The JSON tab is unchanged. Pasting JSON still goes through `addCustomStory`, and
  `richDocument` in JSON is treated as untrusted input like everything else.
* Sessions: nothing in `lib/session` was edited. `DocumentStore` borrows the active
  user's `UserNamespace`, so another user's documents are unreachable by key
  construction. `SessionBoundary` remounts the tree on user switch, so the store is
  rebuilt for the new user.

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

`lib/editor` has no React and no DOM dependency (it runs under Node in the tests);
`components/Editor` is the only layer that touches the browser.

---

## 4. OOP — where and why

### 4.1 Document model (`lib/editor/model`)

| Concept | Where | Why |
|---|---|---|
| **Abstraction + inheritance** | `abstract class Block` with `ParagraphBlock`, `HeadingBlock`, `ListBlock`, `CodeBlock`, `ImageBlock`, `TableBlock`, `RuleBlock`, `PageBreakBlock`, `FootnotesBlock` | one contract (`kind`, `accept`, `isEmpty`) for every kind of content |
| **Immutability / value objects** | every block field is `readonly`; `InlineRun` is a value; `RichDocument.withHtml/withMeta/withPage` return new instances | undo history, autosave diffing and React state can never see a half-mutated object |
| **Visitor (double dispatch)** | `BlockVisitor<R>` implemented by `PlainTextVisitor`, `MarkdownVisitor`, `DocxVisitor`, `StatsVisitor`, `PlainParagraphVisitor` | format-specific behaviour lives outside the blocks. A new export format is a new visitor and no block class changes (**Open/Closed**) |
| **Encapsulation** | `RichDocument` has a private constructor and static factories (`fromHtml`, `fromSnapshot`, `empty`). `fromHtml` always sanitizes | it is impossible to build a document holding unsanitized HTML |
| **Single responsibility** | `BlockExtractor` is the only code that understands HTML structure; the sanitizer only filters; the serializer only prints | a fix to "how nested lists are read" is made once |
| **Lazy cached derivation** | `RichDocument.blocks` and `.stats` | computed once per immutable instance |

### 4.2 Pipeline objects

* `HtmlSanitizer(parser, serializer, stylePolicy)` takes its collaborators through
  the constructor (**Dependency Inversion**), so a stricter policy can be injected.
* `StylePolicy` and `SanitizePolicy.ts` express the allow-list as data plus a small
  object.
* `DocumentExporter` / `DocumentImporter` are **Strategy** interfaces;
  `ExporterRegistry` / `ImporterRegistry` hold them (**Open/Closed**, **Liskov**:
  every exporter is substitutable).
* `ListNumbering` owns the numbering rule once and is shared by the text and
  Markdown visitors.

### 4.3 Editing layer (`components/Editor/engine`)

| Concept | Where |
|---|---|
| **Command** | `EditorCommand`, `ExecCommand`, `FnCommand`, `CommandRegistry`. Ribbon buttons, shortcuts and tests all call `registry.run(id)` |
| **Memento** | `HistoryStack` (bounded snapshot history) and `SelectionMemento` (caret survives focus loss and fullscreen) |
| **Facade** | `EditorSurface` hides contenteditable quirks behind `setHtml / getHtml / exec / insertImageFile / find…`; React only talks to it |
| **Adapter** | `CodeBlockWidget` adapts a `<textarea>` + highlight overlay to the editor. The editing *rules* are in the DOM-free `CodeEditingEngine`, so a CodeMirror adapter could replace the widget only |
| **Data-driven polymorphism** | one `Tokenizer` class driven by a `LanguageSpec` object per language instead of 17 lexers |
| **Pure functions as strategy** | `CodeEditingEngine.tab/enter/type/backspace/toggleComment` take state and return new state, so they are tested with no DOM |
| **State machine encapsulation** | `FullscreenController` (idle → native-fullscreen or fallback → exit) and `ImageResizer` (pointer drag) own their lifecycles and `dispose()` their listeners |
| **Static utility class** | `TableOps` builds a *grid* (a spanning cell occupies several slots) before every operation |

### 4.4 Persistence

`DocumentStore`, `EditorPrefsRepository`, `EditLock`, `AutosaveScheduler<T>` (generic),
`LruCache<K,V>` (generic) are small single-purpose classes composed in
`StoryTextEditor.tsx`, the composition root of this feature, in the same style as
`lib/session/composition.ts`.

---

## 5. OS concepts (as implemented)

### 5.1 Scheduling, buffering, write coalescing
* `AutosaveScheduler` is a **debounced write-back buffer**: a burst of keystrokes
  becomes one write 800 ms after the last, like OS page-cache write-back.
  `flush()` runs on `pagehide` and `visibilitychange → hidden` and on unmount, so
  the last keystrokes are not lost.
* Heavy work is deferred with timers: document sync is trailing-throttled to 180 ms,
  history records after 450 ms of quiet, resize handles use pointer events and
  `ResizeObserver`.

### 5.2 Resources, limits, memory
* History is bounded (150 snapshots); `LruCache` (8 entries) keeps recently opened
  bodies; images are downscaled to ≤ 1600 px before storing; images > 12 MB are
  refused; storage quota failures raise `StorageFullError` instead of crashing.
* The fullscreen controller first uses the Fullscreen API **without moving DOM**.
  If it is denied, the root node is re-parented to `<body>` (a `position: fixed`
  element inside a transformed modal would not cover the viewport) and the
  selection is restored from the memento.

### 5.3 Synchronisation and mutual exclusion
* `EditLock` is a **lease lock**: the holder renews a timestamp every `lease/3`;
  a crashed tab's lease expires, so the lock cannot deadlock. The second tab opens
  the document read-only. After the write it re-reads to detect a racing writer.
  (This is cooperative locking over `localStorage`, not a kernel mutex.)
* `DocumentStore.save` also uses optimistic versions (see §7) so even without the
  lock a stale tab gets `VersionConflictError`.

### 5.4 Process/lifecycle
* Page lifecycle hooks (`pagehide`, `visibilitychange`) are used the way an OS
  uses shutdown hooks.
* Every long-lived object has `dispose()` (listeners, observers, locks).

---

## 6. CN (computer networks) concepts (as implemented)

The editor is **offline by design**; it makes no network requests. The networking
ideas that *are* in the code:

| Concept | Where |
|---|---|
| **Untrusted input at a trust boundary** | pasted HTML, JSON-supplied HTML, imported files and even `localStorage` are parsed and sanitized (§8). Same stance as validating an HTTP request body |
| **URL / scheme handling** | `isSafeUrl` strips control characters inside the scheme (blocks `java\tscript:`), then allows `http/https/mailto/tel` for links and `http/https/data(image only)/sr-img` for images. Links opened in a new tab get `rel="noopener noreferrer"` |
| **Media types (MIME)** | image type allow-list (`png jpeg gif webp avif`), `data:` URL parsing (RFC 2397 base64), correct export MIME types (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/markdown;charset=utf-8`…) |
| **Content negotiation analogue** | paste prefers `text/html`, falls back to `text/plain`, handles `Files` — like choosing a representation from an `Accept` list |
| **Error detection** | `crc32.ts` is the IEEE CRC-32 used in each ZIP entry (same polynomial as Ethernet's FCS), checked against the standard test vector `123456789 → 0xCBF43926` |
| **Framing / binary container** | `ZipWriter` writes local headers, central directory and end-of-central-directory records byte by byte (little-endian) |
| **Character encoding** | UTF-8 via `TextEncoder` for ZIP names and parts; names flagged UTF-8 |
| **Content addressing / idempotency** | an image's id is a SHA-256 prefix of its bytes (`sr-img:<hash>`), so storing it twice is a no-op, like a content-addressed cache |
| **Download semantics** | `Blob` + object URL + `download` attribute, the client-side analogue of `Content-Disposition: attachment` |

Not implemented: no sockets, no server sync for documents, no retry/backoff (there is
nothing remote to retry). The backend still accepts only `paragraphs: string[]`.

---

## 7. DBMS concepts (as implemented)

`DocumentStore` is a tiny per-user database over the app's `KeyValueStore`
(localStorage). It is **not** SQL and not crash-proof ACID; it applies the ideas
that fit a key-value medium.

**Logical schema (per user namespace `srt:v2:u:<user>:docs:…`)**

| Table (key) | Row | Notes |
|---|---|---|
| `index` | `{id PK, title, words, updatedAt, version, bytes}[]` | small, read often (a covering index for the Documents menu) |
| `body:<id>` | `RichDocumentSnapshot` | large, read on open. Split from `index` on purpose (**normalisation / vertical partitioning**), so listing never parses document bodies |
| `img:<hash>` | data URL | **content-addressed**: natural de-duplication; n:m with bodies |
| `draft:<slot>` | snapshot | write-ahead style recovery copy |
| `lock:<id>` | `{owner, until}` | lease row (§5.3) |
| `prefs` | editor UI preferences | |

**Mechanisms**
* **Primary key / uniqueness:** `newId()`; `save` replaces by id.
* **Transaction with rollback:** `save` writes body then index; if the index write
  fails (quota) the body is restored to its previous value. Tested.
* **Optimistic concurrency:** each row has `version`; `save(id, doc, expected)`
  throws `VersionConflictError` if it changed. Tested.
* **Referential integrity / GC:** `collectGarbage()` scans bodies and drafts for
  `sr-img:` references and deletes unreferenced images (reference counting by scan);
  `remove()` calls it. Tested.
* **Consistency check (fsck):** `repair()` drops index rows without a body. Tested.
* **Caching:** `LruCache` in front of body reads.
* **Tenant isolation:** the namespace prefix; the test proves a second user sees
  nothing (`documents are isolated per user`).
* **Integrity constraints on read:** stored snapshots are re-validated
  (`fromSnapshot` clamps margins, whitelists enums) and re-sanitized; a tampered
  `localStorage` value cannot inject script (tested).
* **Normal form of content:** documents are stored as sanitized HTML plus metadata;
  the typed `Block` model is derived (not stored twice), avoiding update anomalies.

Limits: `localStorage` is ≈ 5 MB per origin and synchronous; there is no
multi-statement durability guarantee if the browser dies mid-write.

---

## 8. Security: the sanitizer is the trust boundary

HTML can reach the editor from the JSON tab, paste, imports, shared stories and
storage. It is later assigned to `innerHTML`, so `HtmlSanitizer` is a **white-list**:

* unknown tags are unwrapped; `script style iframe object embed svg math form input …`
  are removed *with* their content;
* attributes: only per-tag allow-list plus `style/class/title/lang/dir` and a fixed
  set of `data-*` (no `on*` ever survives);
* classes must match `sr-*`;
* CSS: per-property validators; any value with `url(`, `expression(`, `javascript:`,
  `@import`, backslashes or `<>` is dropped;
* URLs: see §6; SVG data URLs are rejected;
* nesting deeper than 64 is flattened to text (stack-exhaustion guard);
* the result is idempotent (`sanitize(sanitize(x)) === sanitize(x)`, tested).

Code blocks are stored as `<pre data-lang><code>text</code></pre>` with the text
escaped, and are rebuilt from the textarea value on save, so code survives
save / reopen / export (tested, including in a real browser).

---

## 9. Honest gaps and trade-offs

1. **No Monaco / CodeMirror.** The package registry was unreachable in the build
   environment, so the code widget is hand-written (textarea over a highlighted
   `<pre>`). It is structured so CodeMirror 6 can replace `CodeBlockWidget` alone.
2. **Code folding has no UI.** `CodeEditingEngine.foldRanges()` computes brace/indent
   ranges (tested) but the widget does not render fold markers. **Autocomplete** is not implemented.
3. **Page view is visual, not true pagination.** It shows paper width, margins, page
   guide lines, header and footer once. Real per-page numbering and automatic page
   breaking happen only in the exported `.docx` / print output.
4. **`document.execCommand`** (deprecated but universal) does the inline formatting.
   Undo/redo is the editor's own snapshot history so widget and table changes undo
   correctly; caret restoration after undo is by text offset.
5. **Find** matches within a single text node, so a hit spanning bold/plain boundaries
   is missed. Find inside code blocks uses the widget's own bar (Ctrl+F in the block).
6. **Tables:** table-level border toggle and per-cell colour, but no column-width
   dragging or per-cell border styles.
7. **Multilevel lists:** nesting works; the editor shows the browser default markers,
   the `.docx` uses decimal / letter / roman by depth.
8. **Equations** are a LaTeX-lite → Unicode renderer, not a TeX engine.
9. **Footnotes** are numbered on insertion and not renumbered after deletion.
10. **Images** are stored in localStorage (downscaled); many large images will hit the
    quota (a clear error is shown). No cropping beyond centre aspect presets.
11. **DOCX/PDF import is not supported.** Import: `.txt .md .html .json`. PDF export
    uses the browser's print dialog.
12. **Backend:** the standalone API accepts only `paragraphs: string[]`, so the rich
    snapshot stays on the device; the plain text is what a backend would receive.
13. **Verification:** logic is covered by `npm run test:editor` (40 tests, Node) and
    the DOCX was opened with LibreOffice and python-docx. The UI was exercised in
    headless Chromium (typing, undo, headings, code-block editing, table merge/split,
    image resize, fullscreen, find/replace, XSS paste, save/export). It was **not**
    tested in Firefox/Safari, and a full `next build` could not be run here (no
    dependency install possible), so run `npm install && npm run build` once.

---

## 10. Running the tests

```bash
npm run test:editor    # model, sanitizer, exporters, code engine, store, lock, autosave
npm run test:session   # existing per-user session isolation (unchanged)
```

---

## 11. Reader support (images, tables, code) and quiz-question input

### 11.1 The reader now shows what you wrote
`components/Reader/Reader.tsx` renders a story written in the editor from its rich
snapshot instead of flat paragraphs, so **images, captions, tables, headings, lists,
links and highlighted code blocks** appear in the reading view. Stories without a
snapshot (JSON stories, built-in stories) render exactly as before.

* `StoryContentRenderer` (`lib/editor/reader/`) is a pure class: sanitized HTML tree →
  resolve `sr-img:` references → syntax-highlight `<pre>` with the same `Tokenizer`
  the editor uses → drop neutral text/background colours → **sanitize again** → string.
  Nothing it produces can contain a tag, attribute, class, style or URL the allow-list
  forbids (tested with a hostile snapshot).
* `createStoreImageResolver` looks an image up in the active user's namespace first,
  then in any other user's row with the same content hash (so an adopted story keeps
  its pictures). Whatever it finds is re-validated as a base64 raster data URL; a
  tampered value becomes an "Image unavailable" note, never a `javascript:`/SVG source.
* Black/white/grey text colours are removed in the reader so author-chosen black text
  cannot disappear on the dark theme; chromatic colours (red, blue …) are kept.
* The reading engine is untouched: progress is time-based and the scroll position is
  derived from the live track height (`ResizeObserver`), so taller content such as
  images needs no engine change. The "paragraph x of N" label counts the plain
  paragraphs (code text and captions included).
* The snapshot is used only while it still matches `story.story` (`richDocFor`), so
  text edited elsewhere (for example the JSON tab) is always what the reader shows.
* **GC fix:** `DocumentStore.collectGarbage()` now scans the user's whole namespace,
  including saved stories, so an image used by a story is never deleted when its
  editor draft or document is removed (tested).

Images live in browser storage per user; a story JSON copied to another browser does
not carry its images (they show as "Image unavailable").

### 11.2 Adding quiz questions: one by one **or** JSON / file
`components/Search/QuestionsInput.tsx` is used by both **Add story** and **Edit story**
(media stories keep their existing flow). A toggle switches between:

* **One by one** — question, options (add/remove), correct-answer radio, explanation,
  delete question.
* **JSON / file** — type or paste JSON, drop a `.json`/`.txt` file onto the box, or use
  **Load file**; **Insert example** gives a template.

Both views edit the same list, so you can paste 30 questions, switch to "One by one"
and fix one, and switch back; edits show up in the JSON. The JSON pane is live: valid
JSON replaces the list immediately; invalid JSON keeps the last good list, shows what
is wrong by question number, and disables **Add story** / blocks **Save** until fixed.

Accepted JSON (`lib/questionImport.ts`, tested): an array, `{ "questions": [...] }`
(so a whole story JSON works), or a single question; optionally inside a ```json
fence. Per question: `question` (`q`, `text`), `options` (`choices`, `answers`; 2–12,
no blanks or duplicates), `correctAnswer` (`answer`, `correct`, `correctIndex`,
`correctOption`) and `explanation` (`explain`, `rationale`). The answer may be a
**0-based number**, a **letter** (`"B"`) or the **exact option text**; anything else is
reported, never guessed. Limits: 200 questions, 1 MB file.

The existing story validation still requires at least one question for a text story.

## 12. Code in the reader: IDE-style formatting

Every code snippet is shown on its own lines with indentation kept, highlighted, in a scrollable block (`white-space: pre`, 4-wide tabs, no ligatures, no inherited letter-spacing).

- **Editor code blocks**: dedented, language guessed if "plaintext", and code whose line breaks were lost (one long line) is re-flowed by `beautifyIfCollapsed` (brace languages and JSON; strings and comments are never touched; code that already has several lines is never rewritten).
- **Stories without a rich snapshot** (JSON, PDF, old saves): `plainStoryToHtml` finds ``` fences and multi-line paragraphs that look like code (`looksLikeCode`, a conservative line-scoring heuristic) and renders them the same way. Other multi-line prose keeps its line breaks. Stories with no code keep the original plain layout.
- Code lives in `lib/editor/code/CodeHeuristics.ts`, `lib/editor/reader/CodeFormatter.ts`, `lib/editor/reader/plainStoryHtml.ts`; 6 tests cover it.


## 13. One-click "Format code"

Each code block has a `{ }` button (and **Shift+Alt+F** inside the block) that formats the whole block in its language. If the block is plain text, the language is guessed first and the block switches to it. Ctrl+Z undoes a format.

`lib/editor/code/formatCode.ts` (Strategy pattern, one strategy per language family):
- **JSON**: parse and pretty-print (invalid JSON falls back to bracket indentation).
- **HTML**: tag-depth layout; `<script>` / `<style>` bodies are formatted as JS / CSS; `<pre>` / `<textarea>` stay untouched.
- **Python**: indentation levels are re-derived and re-emitted with the chosen indent (tabs and mixed widths fixed). Lines are never joined or split, because indentation is Python's meaning.
- **SQL**: keywords upper-cased, one clause per line, one column per line, `AND`/`OR` indented.
- **Bash**: `if/fi`, `do/done`, `case/esac`, `{ }` blocks.
- **JS, TS, Java, C, C++, C#, Go, Rust, PHP, CSS** and anything else: re-indent by bracket depth; a single collapsed line is split into statements first.
- Strings and comments are never changed (decided by the language Tokenizer). Formatting is idempotent, and on any internal error the original code is kept. Uses the block's indent setting (2 / 4 / tab).

Also fixed: unterminated-string/comment matching in the Tokenizer used `$` with the multiline flag, which ended triple-quoted strings at the first line; Python `'''` strings are now recognised.

### 13.1 Code whose line breaks were lost

The **✦ Format** button sits right next to the language selector. Code pasted or saved as a single line usually keeps the old indentation as a run of 2+ spaces where each newline was. `splitOnWideGaps` turns those gaps back into line breaks (after `;`, `{`, `}` and after a `//` comment; also `;}`), never inside strings, and the result is then re-indented. If the block is "Plain text" and looks like C-family code (typed declarations, generics, braces), it is detected as Java. The reader uses the same logic for one-line code.
