# Docs writing tool — strategy and challenges

How the Pacewise rich-text writing tool (the "Google Docs"-style editor used for stories) is designed, what was hard, and what is deliberately left for later. The code samples are taken from this repository, with their file path and the principle each one shows.

The structure of the comparison with online collaborative editors (requirements first, then scale, then protocol choice, then conflict handling) follows the general approach found in public system-design material; everything below is written from this project's own code and decisions.

## 1. Requirements we set for ourselves

| Kind | Requirement |
| --- | --- |
| Core | Create, read, update and delete rich documents in the browser; import and export common formats |
| Core | Rich text, blocks, images, tables, and real code blocks with highlighting and auto-indent |
| Non-functional | Never lose typing (autosave + crash recovery); never run untrusted HTML; per-user isolation |
| Non-functional | Works offline in the browser; feels instant (no round trip per keystroke) |
| Out of scope (for now) | Real-time multi-user editing, permissions, comments, server-side version history |

==The most important decision: the document model is the product, not the HTML in the page.== HTML from the browser is untrusted input; it is parsed, sanitized and turned into an immutable, typed model, and everything else (stats, export, reading text) reads that model.

## 2. Strategy in one picture

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

## 3. Decisions and the code that implements them

### 3.1 Untrusted input is sanitized at the only door

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

**Challenge:** pasted content (from Word, web pages, other editors) carries scripts, event handlers and odd styles. **Decision:** allow-list sanitizer, applied in the factory, so no code path can skip it.

### 3.2 New export formats without touching the blocks

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

**Challenge:** DOCX is a zip of XML parts, and Markdown/plain text need different list numbering. **Decision:** one visitor per format, a shared numbering helper, and a small zip writer instead of a heavy dependency.

### 3.3 Never lose the last keystrokes

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

**Challenge:** writing on every keystroke is wasteful; writing only on pause risks losing text when the tab closes. **Decision:** debounce (about 800 ms) plus an explicit flush, and a visible status (dirty / saving / saved / error).

### 3.4 Two tabs must not overwrite each other

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

**Challenge:** the classic lost-update problem across tabs. **Decision:** a renewable lease stored per document; the second tab becomes read-only instead of silently clobbering.

### 3.5 Per-user isolation comes for free from the session layer

The editor's `DocumentStore` borrows the active user's `UserNamespace`, so another user's documents are unreachable by key construction (see `docs/OOP_ARCHITECTURE.md`). Nothing in the session layer was edited to add the editor.

## 4. Why real-time co-editing is deliberately not built yet

Public system-design material on collaborative editors converges on the same ladder, and it is the roadmap here too:

| Question | Options | Our position |
| --- | --- | --- |
| How do clients get updates? | HTTP polling → Server-Sent Events → WebSocket | WebSocket is the right fit (bidirectional, low latency); it needs a separate stateless service behind a queue |
| How are concurrent edits merged? | Last-write-wins → Operational Transformation (OT) → CRDTs | Last-write-wins loses intent; OT preserves intent but is complex and costly with many editors; CRDTs trade metadata size for simpler merging |
| Where does state live? | Metadata in a relational DB, content in object storage | Matches the "drive-like storage" goal in the syllabus |
| How is history kept? | Snapshots, operation logs, or both | Snapshots first (simple, fast to restore); logs later |

**Decision:** ship a very good single-writer editor first (it is the part users touch every minute), keep the document model operation-friendly, and add co-editing only with a backend.

## 5. Challenges and what we learned

| # | Challenge | What we did | Lesson |
| --- | --- | --- | --- |
| 1 | Contenteditable behaves differently across browsers | Wrapped it in one facade (`EditorSurface`); React only talks to the facade | Hide platform quirks behind one object |
| 2 | Unsafe pasted HTML | Allow-list sanitizer in the only factory | Make the safe path the only path |
| 3 | Undo/redo with custom blocks (code, tables, images) | Own bounded history of snapshots plus a selection memento | Native undo breaks with custom widgets |
| 4 | Code blocks need real editing rules | A DOM-free engine for indent, brackets and comments, under a thin widget | Keep rules testable without a browser |
| 5 | Large images blow the browser's storage quota | Downscale to a maximum size and store images separately from text | Storage fails quietly; budget for it |
| 6 | Many export formats | Strategy + Visitor, one class per format | Open/Closed pays off at the second format |
| 7 | Lost updates between tabs | Lease-based edit lock | Prefer locks that expire |
| 8 | Losing text on tab close | Debounced autosave + flush + crash recovery | Save on pause *and* on exit |

## 6. How the docs site itself uses the same ideas

The public documentation pages follow the same philosophy: Markdown is **escaped first**, then only the renderer's own tags are produced, so a document cannot inject HTML; diagrams and code blocks are special, validated holders; and writing tools are plain text conventions (`==highlight==`, `++underline++`, fenced code with `title="…" principle="…"`). See `docs/QUIZ_AND_PROFILE.md`.

## 7. Related documents

- `docs/TEXT_EDITOR.md` — full design, OOP, CN, OS and DBMS notes for the editor
- `docs/OOP_ARCHITECTURE.md` — the per-user session layer the editor relies on
- Research README — the record of challenges and insights across the project

## 8. References (public sources, no text copied)

- WebSocket protocol — RFC 6455: https://www.rfc-editor.org/rfc/rfc6455
- Server-Sent Events — HTML Standard: https://html.spec.whatwg.org/multipage/server-sent-events.html
- Ellis & Gibbs (1989), *Concurrency control in groupware systems* — the origin of Operational Transformation
- Shapiro et al. (2011), *Conflict-free Replicated Data Types* — CRDTs
- OWASP — XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- MDN — `contenteditable` and Selection API: https://developer.mozilla.org/en-US/docs/Web/API/Selection
- General system-design write-up on collaborative document editing (requirements → protocol → conflict handling), used only as a reference for the structure of the discussion
