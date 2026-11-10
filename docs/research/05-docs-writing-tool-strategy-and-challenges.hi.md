# Docs writing tool — strategy और challenges

Pacewise का rich-text writing tool (stories के लिए इस्तेमाल होने वाला "Google Docs"-style editor) कैसे design किया गया है, क्या कठिन था, और क्या जानबूझकर बाद के लिए छोड़ा गया है। Code samples इसी repository से लिए गए हैं, हर एक के file path और उसके दिखाए principle के साथ।

Online collaborative editors से तुलना की संरचना (पहले requirements, फिर scale, फिर protocol choice, फिर conflict handling) public system-design सामग्री में मिलने वाले सामान्य तरीके का अनुसरण करती है; नीचे सब कुछ इसी project के अपने code और decisions से लिखा गया है।

## 1. हमने खुद के लिए कौन सी Requirements तय कीं

| प्रकार | Requirement |
| --- | --- |
| Core | Browser में rich documents बनाना, पढ़ना, update और delete करना; आम formats import और export करना |
| Core | Rich text, blocks, images, tables, और highlighting तथा auto-indent वाले असली code blocks |
| Non-functional | typing कभी न खोए (autosave + crash recovery); untrusted HTML कभी न चले; per-user isolation |
| Non-functional | Browser में offline काम करे; तुरंत महसूस हो (हर keystroke पर round trip नहीं) |
| Out of scope (अभी के लिए) | Real-time multi-user editing, permissions, comments, server-side version history |

==सबसे महत्वपूर्ण निर्णय: document model ही product है, page में मौजूद HTML नहीं।== Browser से आया HTML untrusted input है; उसे parse किया जाता है, sanitize किया जाता है और एक immutable, typed model में बदला जाता है, और बाकी सब कुछ (stats, export, reading text) उसी model को पढ़ता है।

## 2. एक picture में Strategy

```
Ribbon / shortcuts ─► Command registry ─► EditorSurface (contenteditable, history, paste/drop)
                                              │  getHtml()
                                              ▼
                       RichDocument.fromHtml  (always sanitizes)  ─►  typed Blocks
                                              │
              ┌───────────────┬───────────────┼────────────────┬──────────────┐
              ▼               ▼               ▼                ▼              ▼
          Exporters        Stats          Reading text     Autosave     Edit lock
        (txt/md/html/docx)                                  (debounced)  (per document)
                                              │
                                 DocumentStore ─► KeyValueStore + UserNamespace (per-user session layer)
```

## 3. Decisions और उन्हें लागू करने वाला code

### 3.1 Untrusted input को इकलौते दरवाज़े पर sanitize किया जाता है

```ts title="lib/editor/model/RichDocument.ts" principle="Encapsulation — private constructor + static factories: an unsanitized document cannot exist"
private constructor(
  readonly html: string,
  readonly meta: DocumentMeta,
  readonly page: PageSettings
) {}

/** Entry point for UNTRUSTED html: always sanitizes. */
static fromHtml(html: string, meta: DocumentMeta = defaultMeta(), page: PageSettings = DEFAULT_PAGE): RichDocument {
  return new RichDocument(sharedSanitizer.sanitize(html), meta, page);
}
```

**Challenge:** paste किया गया content (Word, web pages, दूसरे editors से) अपने साथ scripts, event handlers और अजीब styles लाता है। **Decision:** allow-list sanitizer, जो factory में लगाया गया है, ताकि कोई भी code path उसे छोड़ न सके।

### 3.2 Blocks को छुए बिना नए export formats

```ts title="lib/editor/model/Blocks.ts" principle="Visitor + Open/Closed — a new format is a new visitor; no block class changes"
export interface BlockVisitor<R> {
  paragraph(block: ParagraphBlock): R;
  heading(block: HeadingBlock): R;
  list(block: ListBlock): R;
  code(block: CodeBlock): R;
  image(block: ImageBlock): R;
  table(block: TableBlock): R;
  rule(block: RuleBlock): R;
  pageBreak(block: PageBreakBlock): R;
  footnotes(block: FootnotesBlock): R;
}
```

```ts title="lib/editor/export/Exporter.ts" principle="Strategy — one class per output format, all substitutable (Liskov)"
export interface DocumentExporter {
  readonly id: string;
  readonly label: string;
  readonly extension: string;
  export(doc: RichDocument, resolveImage?: ImageResolver): ExportResult | Promise<ExportResult>;
}
```

**Challenge:** DOCX XML parts का एक zip है, और Markdown/plain text को अलग list numbering चाहिए। **Decision:** हर format के लिए एक visitor, एक साझा numbering helper, और भारी dependency की जगह एक छोटा zip writer।

### 3.3 आख़िरी keystrokes कभी न खोएँ

```ts title="lib/editor/persistence/AutosaveScheduler.ts" principle="Debounce / write coalescing — a burst of edits becomes one write; flush() on tab hide or unmount"
schedule(value: T): void {
  this.pending = value;
  this.hasPending = true;
  this.set("dirty");
  if (this.timer) clearTimeout(this.timer);
  this.timer = setTimeout(() => this.flush(), this.delayMs);
}

flush(): void {
  if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  if (!this.hasPending) return;
  const v = this.pending as T;
  this.hasPending = false;
  this.pending = undefined;
  this.set("saving");
  try { this.write(v); this.set("saved"); } catch (e) { this.set("error", e); }
}
```

**Challenge:** हर keystroke पर लिखना फ़िज़ूल है; सिर्फ़ रुकने पर लिखने से tab बंद होते समय text खोने का जोखिम है। **Decision:** debounce (लगभग 800 ms) के साथ एक स्पष्ट flush, और एक दिखने वाला status (dirty / saving / saved / error)।

### 3.4 दो tabs एक-दूसरे को overwrite न करें

```ts title="lib/editor/persistence/EditLock.ts" principle="Lock with a lease (OS) — a crashed holder's lease expires, so the lock cannot deadlock"
acquire(): boolean {
  const cur = this.read();
  if (cur && cur.owner !== this.owner && cur.until > this.now()) return false;
  this.write();
  // Re-read: if another tab wrote between our check and write, the last writer wins.
  if (this.read()?.owner !== this.owner) return false;
  if (!this.beat && typeof setInterval !== "undefined") this.beat = setInterval(() => this.write(), this.leaseMs / 3);
  return true;
}
```

**Challenge:** tabs के बीच classic lost-update problem। **Decision:** हर document के लिए रखा गया renewable lease; दूसरा tab चुपचाप clobber करने की जगह read-only बन जाता है।

### 3.5 Per-user isolation session layer से मुफ़्त में मिलता है

Editor का `DocumentStore` active user का `UserNamespace` उधार लेता है, इसलिए key बनाने के तरीके से ही दूसरे user के documents पहुँच से बाहर रहते हैं (देखें `docs/OOP_ARCHITECTURE.md`)। Editor जोड़ने के लिए session layer में कुछ भी edit नहीं किया गया।

## 4. Real-time co-editing अभी जानबूझकर क्यों नहीं बनाई गई

Collaborative editors पर public system-design सामग्री एक ही सीढ़ी पर पहुँचती है, और यहाँ भी roadmap वही है:

| सवाल | Options | हमारी स्थिति |
| --- | --- | --- |
| Clients को updates कैसे मिलते हैं? | HTTP polling → Server-Sent Events → WebSocket | WebSocket सही fit है (bidirectional, low latency); इसे queue के पीछे एक अलग stateless service चाहिए |
| Concurrent edits कैसे merge होते हैं? | Last-write-wins → Operational Transformation (OT) → CRDTs | Last-write-wins intent खो देता है; OT intent सुरक्षित रखता है पर कई editors के साथ जटिल और महँगा है; CRDTs metadata size के बदले सरल merging देते हैं |
| State कहाँ रहती है? | Metadata relational DB में, content object storage में | Syllabus के "drive-like storage" लक्ष्य से मेल खाता है |
| History कैसे रखी जाती है? | Snapshots, operation logs, या दोनों | पहले snapshots (सरल, restore करना तेज़); logs बाद में |

**Decision:** पहले एक बहुत अच्छा single-writer editor दें (यही वह हिस्सा है जिसे users हर मिनट छूते हैं), document model को operation-friendly रखें, और co-editing तभी जोड़ें जब backend हो।

## 5. Challenges और हमने क्या सीखा

| # | Challenge | हमने क्या किया | सबक |
| --- | --- | --- | --- |
| 1 | Contenteditable अलग-अलग browsers में अलग व्यवहार करता है | उसे एक facade (`EditorSurface`) में लपेटा; React सिर्फ़ facade से बात करता है | Platform की quirks को एक object के पीछे छिपाएँ |
| 2 | असुरक्षित paste किया गया HTML | इकलौती factory में allow-list sanitizer | सुरक्षित रास्ते को ही इकलौता रास्ता बनाएँ |
| 3 | Custom blocks (code, tables, images) के साथ Undo/redo | Snapshots की अपनी bounded history और एक selection memento | Custom widgets के साथ native undo टूट जाता है |
| 4 | Code blocks को असली editing rules चाहिए | Indent, brackets और comments के लिए एक DOM-free engine, पतले widget के नीचे | Rules को browser के बिना testable रखें |
| 5 | बड़ी images browser का storage quota फोड़ देती हैं | अधिकतम size तक downscale किया और images को text से अलग store किया | Storage चुपचाप fail होता है; उसके लिए budget रखें |
| 6 | कई export formats | Strategy + Visitor, हर format के लिए एक class | दूसरे format पर Open/Closed का फ़ायदा मिलता है |
| 7 | Tabs के बीच lost updates | Lease-based edit lock | ऐसे locks चुनें जो expire हो जाएँ |
| 8 | Tab बंद होने पर text खोना | Debounced autosave + flush + crash recovery | रुकने पर *और* बाहर निकलते समय save करें |

## 6. Docs site खुद इन्हीं विचारों का उपयोग कैसे करती है

Public documentation pages भी यही दर्शन अपनाते हैं: Markdown **पहले escape** किया जाता है, फिर सिर्फ़ renderer के अपने tags बनाए जाते हैं, इसलिए कोई document HTML inject नहीं कर सकता; diagrams और code blocks विशेष, validated holders हैं; और writing tools सादे text conventions हैं (`==highlight==`, `++underline++`, `title="…" principle="…"` वाला fenced code)। देखें `docs/QUIZ_AND_PROFILE.md`।

## 7. संबंधित documents

- `docs/TEXT_EDITOR.md` — editor के लिए पूरा design, OOP, CN, OS और DBMS notes
- `docs/OOP_ARCHITECTURE.md` — per-user session layer जिस पर editor निर्भर है
- Research README — पूरे project के challenges और insights का record

## 8. References (public sources, कोई text copy नहीं किया गया)

- WebSocket protocol — RFC 6455: https://www.rfc-editor.org/rfc/rfc6455
- Server-Sent Events — HTML Standard: https://html.spec.whatwg.org/multipage/server-sent-events.html
- Ellis & Gibbs (1989), *Concurrency control in groupware systems* — Operational Transformation की उत्पत्ति
- Shapiro et al. (2011), *Conflict-free Replicated Data Types* — CRDTs
- OWASP — XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- MDN — `contenteditable` and Selection API: https://developer.mozilla.org/en-US/docs/Web/API/Selection
- Collaborative document editing पर एक सामान्य system-design write-up (requirements → protocol → conflict handling), जो सिर्फ़ चर्चा की संरचना के लिए reference के रूप में इस्तेमाल हुआ
