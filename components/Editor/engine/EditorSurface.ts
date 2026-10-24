import { HtmlSanitizer } from "@/lib/editor/html/HtmlSanitizer";
import { CodeBlockWidget, CodePrefs } from "@/components/Editor/engine/CodeBlockWidget";
import { HistoryStack } from "@/components/Editor/engine/HistoryStack";
import { SelectionMemento, restoreOffsets, selectionOffsets, textNodes } from "@/components/Editor/engine/SelectionMemento";
import { TableOps } from "@/components/Editor/engine/TableOps";
import { renderTexLite } from "@/lib/editor/format/TexLite";

export interface SurfaceHooks {
  onChange(): void;
  onSelection(): void;
  onShortcut(name: "find" | "save" | "link" | "fullscreen"): void;
  resolveImage(src: string): string | null;
  storeImage(dataUrl: string): Promise<string>;
  codePrefs(): CodePrefs;
  notify(message: string): void;
}

export interface FormatState {
  bold: boolean; italic: boolean; underline: boolean; strike: boolean; sub: boolean; sup: boolean;
  ul: boolean; ol: boolean; checklist: boolean;
  block: string; align: string; fontFamily: string; fontSize: string; color: string;
  inTable: boolean; inCode: boolean; image: boolean;
}

const BLOCKS = "p,div,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,figcaption,pre";
const MAX_IMG_EDGE = 1600;
const sanitizer = new HtmlSanitizer();

/**
 * The editing surface: owns the contenteditable element and everything
 * DOM-specific about it. The React shell only talks to this class.
 *
 *  - hydrate()/serialize(): the stored document is plain sanitized HTML; at
 *    runtime `<pre>` becomes a CodeBlockWidget island and `sr-img:` sources
 *    become displayable data URLs. serialize() reverses both.
 *  - history: whole-document snapshots (HistoryStack) instead of the
 *    browser's native stack, because widgets / table operations / image
 *    inserts mutate the DOM programmatically and would corrupt it.
 */
export class EditorSurface {
  readonly memento: SelectionMemento;
  readonly history = new HistoryStack();
  private widgets = new Set<CodeBlockWidget>();
  private selectedImage: HTMLImageElement | null = null;
  private recordTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHtml = "";
  private composing = false;
  private suppress = false;
  private listeners: Array<[EventTarget, string, EventListener]> = [];
  private findRanges: Range[] = [];
  private findIdx = -1;

  constructor(readonly el: HTMLElement, private readonly hooks: SurfaceHooks) {
    this.memento = new SelectionMemento(el);
    el.setAttribute("contenteditable", "true");
    el.setAttribute("role", "textbox");
    el.setAttribute("aria-multiline", "true");
    try { document.execCommand("styleWithCSS", false, "true"); document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* ignore */ }
    this.on(el, "input", () => this.handleInput());
    this.on(el, "keydown", (e) => this.handleKey(e as KeyboardEvent));
    this.on(el, "paste", (e) => this.handlePaste(e as ClipboardEvent));
    this.on(el, "dragover", (e) => { if ((e as DragEvent).dataTransfer?.types.includes("Files")) e.preventDefault(); });
    this.on(el, "drop", (e) => this.handleDrop(e as DragEvent));
    this.on(el, "click", (e) => this.handleClick(e as MouseEvent));
    this.on(el, "beforeinput", (e) => {
      const t = (e as InputEvent).inputType;
      if (t === "historyUndo") { e.preventDefault(); this.undo(); }
      if (t === "historyRedo") { e.preventDefault(); this.redo(); }
    });
    this.on(el, "compositionstart", () => { this.composing = true; });
    this.on(el, "compositionend", () => { this.composing = false; this.handleInput(); });
    this.on(document, "selectionchange", () => {
      const s = window.getSelection();
      if (s && el.contains(s.anchorNode)) { this.memento.save(); this.hooks.onSelection(); }
    });
  }

  private on(t: EventTarget, ev: string, fn: EventListener): void { t.addEventListener(ev, fn); this.listeners.push([t, ev, fn]); }

  dispose(): void {
    this.listeners.forEach(([t, ev, fn]) => t.removeEventListener(ev, fn));
    this.listeners = [];
    if (this.recordTimer) clearTimeout(this.recordTimer);
    this.clearFindHighlight();
  }

  // --- document <-> DOM -------------------------------------------------------
  setHtml(html: string, opts: { resetHistory?: boolean } = {}): void {
    this.suppress = true;
    this.widgets.clear();
    this.el.innerHTML = html || "<p><br></p>";
    this.hydrate();
    this.suppress = false;
    this.lastHtml = this.serialize();
    if (opts.resetHistory) this.history.reset({ html: this.lastHtml, selStart: 0, selEnd: 0 });
  }

  private hydrate(): void {
    this.el.querySelectorAll("pre").forEach((pre) => {
      this.replaceWithWidget(pre, pre.textContent?.replace(/\n$/, "") ?? "", pre.getAttribute("data-lang") ?? "plaintext");
    });
    this.el.querySelectorAll("img").forEach((img) => this.hydrateImage(img));
    this.el.querySelectorAll(".sr-math").forEach((m) => m.setAttribute("contenteditable", "false"));
    this.el.querySelectorAll("ul.sr-check > li").forEach((li) => { if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false"); });
    this.ensureEdgeParagraphs();
  }

  private hydrateImage(img: HTMLImageElement): void {
    const src = img.getAttribute("src") ?? "";
    if (src.startsWith("sr-img:")) {
      img.setAttribute("data-sr-src", src);
      const real = this.hooks.resolveImage(src);
      if (real) img.setAttribute("src", real); else img.removeAttribute("src");
    }
    if (!img.closest("figure")) {
      const fig = document.createElement("figure");
      fig.className = "sr-figure";
      const cap = document.createElement("figcaption");
      img.replaceWith(fig);
      fig.append(img, cap);
    }
    img.setAttribute("draggable", "false");
  }

  private ensureEdgeParagraphs(): void {
    const isWidgetLike = (n: Element | null) => !!n && (n.classList.contains("sr-code-widget") || n.tagName === "TABLE" || n.tagName === "FIGURE" || n.tagName === "HR");
    if (!this.el.firstElementChild || isWidgetLike(this.el.firstElementChild)) this.el.insertBefore(this.blankParagraph(), this.el.firstChild);
    if (isWidgetLike(this.el.lastElementChild)) this.el.appendChild(this.blankParagraph());
  }

  private blankParagraph(): HTMLParagraphElement {
    const p = document.createElement("p");
    p.innerHTML = "<br>";
    return p;
  }

  /** Clean HTML (what gets sanitized, stored, exported). */
  serialize(): string {
    // Clone into an inert document so rewriting <img src> never triggers a network fetch.
    const inert = document.implementation.createHTMLDocument("");
    const clone = inert.importNode(this.el, true) as HTMLElement;
    clone.querySelectorAll(".sr-code-widget").forEach((w) => {
      const pre = inert.createElement("pre");
      pre.setAttribute("data-lang", w.getAttribute("data-lang") ?? "plaintext");
      const code = inert.createElement("code");
      code.textContent = w.getAttribute("data-code") ?? "";
      pre.appendChild(code);
      w.replaceWith(pre);
    });
    clone.querySelectorAll("img").forEach((img) => {
      const orig = img.getAttribute("data-sr-src");
      if (orig) img.setAttribute("src", orig);
      img.removeAttribute("data-sr-src");
      img.removeAttribute("draggable");
      img.classList.remove("sr-img-selected");
    });
    clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    clone.querySelectorAll("figcaption").forEach((c) => { if (!c.textContent?.trim()) c.remove(); });
    clone.querySelectorAll("mark.sr-find").forEach((m) => m.replaceWith(...Array.from(m.childNodes)));
    return clone.innerHTML;
  }

  /** Sanitized HTML ready for `RichDocument.withHtml`. */
  getHtml(): string { return sanitizer.sanitize(this.serialize()); }

  // --- history ------------------------------------------------------------------
  private handleInput(): void {
    if (this.suppress || this.composing) return;
    this.normalizeChecklists();
    this.hooks.onChange();
    this.scheduleRecord();
  }

  private normalizeChecklists(): void {
    this.el.querySelectorAll("ul.sr-check > li:not([data-checked])").forEach((li) => li.setAttribute("data-checked", "false"));
  }

  private scheduleRecord(): void {
    if (this.recordTimer) clearTimeout(this.recordTimer);
    this.recordTimer = setTimeout(() => this.record(), 450);
  }

  /** Push a history entry now (call BEFORE and after discrete commands). */
  record(): void {
    if (this.recordTimer) { clearTimeout(this.recordTimer); this.recordTimer = null; }
    const html = this.serialize();
    const sel = selectionOffsets(this.el);
    if (this.history.push({ html, selStart: sel.start, selEnd: sel.end })) this.lastHtml = html;
  }

  /** Mutates the DOM through `fn` as one undoable step. */
  transact(fn: () => void): void {
    this.record();
    fn();
    this.hooks.onChange();
    this.record();
  }

  undo(): void { this.record(); const e = this.history.undo(); if (e) this.restore(e); }
  redo(): void { this.record(); const e = this.history.redo(); if (e) this.restore(e); }
  private restore(e: { html: string; selStart: number; selEnd: number }): void {
    this.setHtml(e.html);
    this.focus();
    restoreOffsets(this.el, e.selStart, e.selEnd);
    this.hooks.onChange();
    this.hooks.onSelection();
  }

  focus(): void { this.el.focus({ preventScroll: true }); }

  // --- commands used by the ribbon ---------------------------------------------
  exec(command: string, value?: string): boolean {
    this.memento.restore();
    this.record();
    let ok = false;
    try { ok = document.execCommand(command, false, value); } catch { ok = false; }
    this.afterEdit();
    return ok;
  }

  afterEdit(): void {
    this.hooks.onChange();
    this.record();
    this.hooks.onSelection();
  }

  insertHtml(html: string): void {
    const clean = sanitizer.sanitize(html);
    this.memento.restore();
    this.record();
    document.execCommand("insertHTML", false, clean);
    this.postInsert();
  }

  private postInsert(): void {
    this.el.querySelectorAll("pre").forEach((pre) => this.replaceWithWidget(pre, pre.textContent?.replace(/\n$/, "") ?? "", pre.getAttribute("data-lang") ?? "plaintext"));
    this.el.querySelectorAll("img").forEach((img) => { if (!img.closest("figure")) this.hydrateImage(img); });
    this.el.querySelectorAll(".sr-math").forEach((m) => m.setAttribute("contenteditable", "false"));
    this.ensureEdgeParagraphs();
    this.hooks.onChange();
    this.record();
  }

  insertText(text: string): void {
    this.memento.restore();
    document.execCommand("insertText", false, text);
    this.afterEdit();
  }

  topBlock(node: Node | null): HTMLElement | null {
    let n: Node | null = node;
    while (n && n.parentNode !== this.el) n = n.parentNode;
    return n instanceof HTMLElement ? n : null;
  }

  currentRange(): Range | null {
    const s = window.getSelection();
    return s && s.rangeCount && this.el.contains(s.anchorNode) ? s.getRangeAt(0) : null;
  }

  /** Nearest block-level elements touched by the selection. */
  selectedBlocks(): HTMLElement[] {
    const r = this.currentRange() ?? this.memento.saved;
    if (!r) return [];
    const out = new Set<HTMLElement>();
    const climb = (n: Node): HTMLElement | null => {
      let x: Node | null = n.nodeType === 3 ? n.parentNode : n;
      while (x && x !== this.el) { if (x instanceof HTMLElement && x.matches(BLOCKS)) return x; x = x.parentNode; }
      return null;
    };
    const a = climb(r.startContainer), b = climb(r.endContainer);
    if (a) out.add(a);
    if (b) out.add(b);
    if (a && b && a !== b) {
      const walker = document.createTreeWalker(this.el, NodeFilter.SHOW_ELEMENT);
      let on = false;
      for (let n = walker.nextNode() as HTMLElement | null; n; n = walker.nextNode() as HTMLElement | null) {
        if (n === a) on = true;
        if (on && n.matches(BLOCKS) && !n.closest(".sr-code-widget")) out.add(n);
        if (n === b) break;
      }
    }
    return Array.from(out);
  }

  styleBlocks(fn: (el: HTMLElement) => void): void {
    this.memento.restore();
    this.transact(() => this.selectedBlocks().forEach(fn));
  }

  // --- code blocks ------------------------------------------------------------------
  private replaceWithWidget(node: Element, code: string, lang: string): CodeBlockWidget {
    const w = new CodeBlockWidget(
      code, lang, this.hooks.codePrefs(),
      () => { this.hooks.onChange(); this.scheduleRecord(); },
      (widget) => this.exitWidget(widget),
      (widget) => this.removeWidget(widget)
    );
    node.replaceWith(w.root);
    this.widgets.add(w);
    return w;
  }

  insertCodeBlock(lang = "plaintext", code = ""): void {
    this.memento.restore();
    this.record();
    const r = this.currentRange();
    const block = this.topBlock(r?.startContainer ?? null);
    const holder = document.createElement("div");
    let w: CodeBlockWidget;
    if (block && block.tagName === "P" && !block.textContent?.trim() && !block.querySelector("img")) {
      block.replaceWith(holder);
      w = this.replaceWithWidget(holder, code, lang);
    } else if (block) {
      block.after(holder);
      w = this.replaceWithWidget(holder, code, lang);
    } else {
      this.el.appendChild(holder);
      w = this.replaceWithWidget(holder, code, lang);
    }
    this.ensureEdgeParagraphs();
    this.hooks.onChange();
    this.record();
    w.focus();
  }

  /** Turns the selected text (or the current block) into a code block. */
  convertSelectionToCode(lang = "plaintext"): void {
    this.memento.restore();
    const r = this.currentRange();
    if (!r) return this.insertCodeBlock(lang);
    const blocks = this.selectedBlocks().filter((b) => !b.closest("li,td,th,.sr-code-widget") || b.tagName === "LI");
    let text = r.collapsed ? "" : window.getSelection()?.toString() ?? "";
    if (r.collapsed && blocks.length) text = blocks.map((b) => b.innerText ?? b.textContent ?? "").join("\n");
    this.record();
    const holder = document.createElement("div");
    const anchor = blocks[0] ?? this.topBlock(r.startContainer);
    if (!anchor) return this.insertCodeBlock(lang, text);
    const top = this.topBlock(anchor) ?? anchor;
    top.after(holder);
    this.replaceWithWidget(holder, text.replace(/ /g, " "), lang).focus();
    if (!r.collapsed) r.deleteContents();
    blocks.forEach((b) => { if (b.isConnected && !b.textContent?.trim() && b !== this.el) (this.topBlock(b) ?? b).remove(); });
    this.ensureEdgeParagraphs();
    this.hooks.onChange();
    this.record();
  }

  setCodePrefsForAll(p: Partial<CodePrefs>): void { this.widgets.forEach((w) => w.setPrefs(p)); }
  private exitWidget(w: CodeBlockWidget): void {
    let next = w.root.nextElementSibling as HTMLElement | null;
    if (!next || next.classList.contains("sr-code-widget")) { next = this.blankParagraph(); w.root.after(next); }
    this.focus();
    const r = document.createRange();
    r.selectNodeContents(next);
    r.collapse(true);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  }
  private removeWidget(w: CodeBlockWidget): void {
    this.transact(() => { this.widgets.delete(w); w.root.remove(); this.ensureEdgeParagraphs(); });
  }

  // --- images -----------------------------------------------------------------------
  async insertImageFile(file: File): Promise<void> {
    if (!/^image\/(png|jpe?g|gif|webp|avif)$/i.test(file.type)) { this.hooks.notify("That file type isn't a supported image."); return; }
    if (file.size > 12 * 1024 * 1024) { this.hooks.notify("Image is larger than 12 MB."); return; }
    try {
      const dataUrl = await this.downscale(file);
      const id = await this.hooks.storeImage(dataUrl);
      this.insertImageRef(id, dataUrl, file.name.replace(/\.[^.]+$/, ""));
    } catch {
      this.hooks.notify("Couldn't store that image (browser storage may be full).");
    }
  }

  private downscale(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_IMG_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale === 1 && file.size < 400 * 1024) {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(file);
          return;
        }
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(file.type === "image/png" || file.type === "image/gif" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }

  insertImageRef(id: string, dataUrl: string, alt: string): void {
    this.memento.restore();
    this.record();
    const fig = document.createElement("figure");
    fig.className = "sr-figure";
    fig.setAttribute("data-align", "center");
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = alt;
    img.setAttribute("data-sr-src", `sr-img:${id}`);
    img.setAttribute("data-img-id", id);
    img.setAttribute("draggable", "false");
    fig.append(img, document.createElement("figcaption"));
    const r = this.currentRange();
    const block = this.topBlock(r?.startContainer ?? null);
    if (block && block.tagName === "P" && !block.textContent?.trim()) block.replaceWith(fig);
    else if (block) block.after(fig);
    else this.el.appendChild(fig);
    this.ensureEdgeParagraphs();
    this.hooks.onChange();
    this.record();
  }

  get image(): HTMLImageElement | null { return this.selectedImage && this.el.contains(this.selectedImage) ? this.selectedImage : null; }
  selectImage(img: HTMLImageElement | null): void {
    this.selectedImage?.classList.remove("sr-img-selected");
    this.selectedImage = img;
    img?.classList.add("sr-img-selected");
    this.hooks.onSelection();
  }

  private handleClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLImageElement && this.el.contains(t)) { this.selectImage(t); return; }
    if (this.selectedImage) this.selectImage(null);
    const li = t.closest("ul.sr-check > li") as HTMLElement | null;
    if (li && li.parentElement?.classList.contains("sr-check") && e.offsetX < 24 && e.target === li) {
      this.transact(() => li.setAttribute("data-checked", li.getAttribute("data-checked") === "true" ? "false" : "true"));
    }
  }

  // --- paste / drop / keys ----------------------------------------------------------
  private handlePaste(e: ClipboardEvent): void {
    const dt = e.clipboardData;
    if (!dt) return;
    const files = Array.from(dt.files).filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); files.forEach((f) => void this.insertImageFile(f)); return; }
    const html = dt.getData("text/html");
    const text = dt.getData("text/plain");
    e.preventDefault();
    if (html) { this.insertHtml(html); return; }
    if (text) this.insertText(text);
  }

  private handleDrop(e: DragEvent): void {
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    const pos = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(e.clientX, e.clientY);
    if (pos) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(pos); this.memento.save(); }
    files.forEach((f) => void this.insertImageFile(f));
  }

  private handleKey(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
    if (mod && k === "y") { e.preventDefault(); this.redo(); return; }
    if (mod && k === "f") { e.preventDefault(); this.hooks.onShortcut("find"); return; }
    if (mod && k === "s") { e.preventDefault(); this.hooks.onShortcut("save"); return; }
    if (mod && k === "k") { e.preventDefault(); this.memento.save(); this.hooks.onShortcut("link"); return; }
    if (e.key === "F11") { e.preventDefault(); this.hooks.onShortcut("fullscreen"); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && this.image && document.activeElement === this.el && window.getSelection()?.isCollapsed) {
      const fig = this.image.closest("figure");
      if (fig && !(document.activeElement as HTMLElement).closest("figcaption")) { e.preventDefault(); this.transact(() => { fig.remove(); this.selectImage(null); this.ensureEdgeParagraphs(); }); return; }
    }
    if (e.key === "Tab") { this.handleTab(e); return; }
    if (e.key === "Enter" && !e.shiftKey && !mod) this.handleEnter(e);
  }

  private anchorElement(): HTMLElement | null {
    const n = window.getSelection()?.anchorNode ?? null;
    return n ? (n.nodeType === 3 ? n.parentElement : (n as HTMLElement)) : null;
  }

  private handleTab(e: KeyboardEvent): void {
    const a = this.anchorElement();
    if (!a || !this.el.contains(a)) return;
    const cell = a.closest("td,th") as HTMLTableCellElement | null;
    if (a.closest("li")) { e.preventDefault(); this.exec(e.shiftKey ? "outdent" : "indent"); return; }
    if (cell) {
      e.preventDefault();
      const table = cell.closest("table") as HTMLTableElement;
      const cells = Array.from(table.querySelectorAll("td,th")) as HTMLTableCellElement[];
      let i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
      if (i >= cells.length) { TableOps.addRow(table, cells[cells.length - 1], true); this.hooks.onChange(); i = cells.length; }
      const next = (Array.from(table.querySelectorAll("td,th")) as HTMLTableCellElement[])[Math.max(0, i)];
      const r = document.createRange();
      r.selectNodeContents(next);
      r.collapse(true);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      return;
    }
    e.preventDefault();
    this.exec(e.shiftKey ? "outdent" : "indent");
  }

  private handleEnter(e: KeyboardEvent): void {
    const a = this.anchorElement();
    if (!a || !this.el.contains(a)) return;
    // ```lang + Enter → code block
    const block = a.closest("p,div");
    const m = block && block.parentElement === this.el ? /^```([\w+#-]*)$/.exec(block.textContent?.trim() ?? "") : null;
    if (block && m) {
      e.preventDefault();
      this.record();
      const holder = document.createElement("div");
      block.replaceWith(holder);
      this.replaceWithWidget(holder, "", m[1] || "plaintext").focus();
      this.ensureEdgeParagraphs();
      this.hooks.onChange();
      return;
    }
    const li = a.closest("ul.sr-check > li");
    if (li) setTimeout(() => {
      const cur = this.anchorElement()?.closest("li");
      if (cur && cur.parentElement?.classList.contains("sr-check")) cur.setAttribute("data-checked", "false");
    }, 0);
  }

  // --- state query -----------------------------------------------------------------
  queryState(): FormatState {
    const q = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
    const a = this.anchorElement();
    const inside = !!a && this.el.contains(a);
    const cs = inside && a ? getComputedStyle(a) : null;
    const blockEl = inside && a ? (a.closest("h1,h2,h3,h4,h5,h6,blockquote,p,div,li") as HTMLElement | null) : null;
    let block = blockEl?.tagName.toLowerCase() ?? "p";
    if (blockEl?.classList.contains("sr-title")) block = "title";
    else if (blockEl?.classList.contains("sr-subtitle")) block = "subtitle";
    if (block === "div" || block === "li") block = "p";
    return {
      bold: q("bold"), italic: q("italic"), underline: q("underline"), strike: q("strikeThrough"), sub: q("subscript"), sup: q("superscript"),
      ul: q("insertUnorderedList"), ol: q("insertOrderedList"), checklist: !!a?.closest("ul.sr-check"),
      block, align: cs?.textAlign === "start" ? "left" : cs?.textAlign ?? "left",
      fontFamily: cs?.fontFamily.split(",")[0].replace(/["']/g, "").trim() ?? "", fontSize: cs?.fontSize ?? "", color: cs?.color ?? "",
      inTable: !!a?.closest("table"), inCode: false, image: !!this.image,
    };
  }

  currentCell(): HTMLTableCellElement | null {
    const a = this.anchorElement() ?? (this.memento.saved?.startContainer.nodeType === 3 ? this.memento.saved.startContainer.parentElement : (this.memento.saved?.startContainer as HTMLElement | undefined) ?? null);
    return (a?.closest("td,th") as HTMLTableCellElement | null) ?? null;
  }

  outline(): Array<{ level: number; text: string; el: HTMLElement }> {
    return Array.from(this.el.querySelectorAll("h1,h2,h3,h4,h5,h6,p.sr-title")).map((h) => ({
      level: h.tagName === "P" ? 1 : Number(h.tagName[1]), text: h.textContent?.trim() || "(empty heading)", el: h as HTMLElement,
    }));
  }

  insertMath(tex: string): void {
    this.insertHtml(`<span class="sr-math" data-tex="${tex.replace(/"/g, "&quot;")}">${renderTexLite(tex).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>&nbsp;`);
  }

  insertFootnote(text: string): void {
    this.record();
    let sec = this.el.querySelector("section.sr-footnotes") as HTMLElement | null;
    if (!sec) {
      sec = document.createElement("section");
      sec.className = "sr-footnotes";
      sec.innerHTML = "<hr><ol></ol>";
      this.el.appendChild(sec);
    }
    const ol = sec.querySelector("ol")!;
    const n = String(ol.children.length + 1);
    const li = document.createElement("li");
    li.setAttribute("data-fn", n);
    li.textContent = text;
    ol.appendChild(li);
    this.memento.restore();
    document.execCommand("insertHTML", false, `<sup class="sr-fnref" data-fn="${n}">[${n}]</sup>`);
    this.hooks.onChange();
    this.record();
  }

  // --- find & replace ---------------------------------------------------------------
  find(query: string, matchCase: boolean): number {
    this.clearFindHighlight();
    this.findRanges = [];
    this.findIdx = -1;
    if (!query) return 0;
    const needle = matchCase ? query : query.toLowerCase();
    for (const t of textNodes(this.el)) {
      const hay = matchCase ? t.data : t.data.toLowerCase();
      for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) {
        const r = document.createRange();
        r.setStart(t, i);
        r.setEnd(t, i + needle.length);
        this.findRanges.push(r);
      }
    }
    const H = (globalThis as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    if (H && reg) reg.set("sr-find", new H(...this.findRanges));
    return this.findRanges.length;
  }

  findStep(dir: 1 | -1): { index: number; total: number } {
    const total = this.findRanges.length;
    if (!total) return { index: 0, total };
    this.findIdx = (this.findIdx + dir + total) % total;
    const r = this.findRanges[this.findIdx];
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    (r.startContainer.parentElement as HTMLElement | null)?.scrollIntoView({ block: "center" });
    return { index: this.findIdx + 1, total };
  }

  replaceCurrent(query: string, value: string, matchCase: boolean): void {
    const r = this.findRanges[this.findIdx];
    if (!r) return;
    this.record();
    r.deleteContents();
    r.insertNode(document.createTextNode(value));
    this.hooks.onChange();
    this.record();
    this.find(query, matchCase);
    this.findIdx = -1;
  }

  replaceAll(query: string, value: string, matchCase: boolean): number {
    const n = this.find(query, matchCase);
    if (!n) return 0;
    this.record();
    for (const r of [...this.findRanges].reverse()) { r.deleteContents(); r.insertNode(document.createTextNode(value)); }
    this.el.normalize();
    this.clearFindHighlight();
    this.findRanges = [];
    this.hooks.onChange();
    this.record();
    return n;
  }

  clearFindHighlight(): void {
    (CSS as unknown as { highlights?: Map<string, unknown> }).highlights?.delete("sr-find");
  }
}
