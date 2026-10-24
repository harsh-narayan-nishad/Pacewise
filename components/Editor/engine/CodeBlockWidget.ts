import { formatCode } from "@/lib/editor/code/formatCode";
import { LANGUAGES, getLanguage, getTokenizer } from "@/lib/editor/code/languages";
import { CodeEditingEngine, EditState } from "@/lib/editor/code/CodeEditingEngine";

export interface CodePrefs {
  indent: "2" | "4" | "tab";
  theme: "dark" | "light";
  lineNumbers: boolean;
  wrap: boolean;
  whitespace: boolean;
}
export const DEFAULT_CODE_PREFS: CodePrefs = { indent: "2", theme: "dark", lineNumbers: true, wrap: false, whitespace: false };

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

/**
 * A self-contained code editor mounted inside the document as a
 * non-editable island: header (language, tools), line-number gutter,
 * syntax-highlighted textarea, find/replace bar.
 *
 * Rendering = transparent <textarea> (caret, selection, IME, undo, a11y all
 * native) stacked over a highlighted <pre>. The text lives in the
 * textarea; `data-code` mirrors it so the document serializer can read it
 * without touching widget internals.
 *
 * Why not Monaco/CodeMirror: the package registry was unreachable in the
 * build environment; the editing rules live in `CodeEditingEngine` /
 * `Tokenizer` (no DOM) so a CodeMirror adapter can replace this class only.
 */
export class CodeBlockWidget {
  readonly root: HTMLDivElement;
  private readonly ta: HTMLTextAreaElement;
  private readonly hl: HTMLPreElement;
  private readonly gutter: HTMLDivElement;
  private readonly lineHl: HTMLDivElement;
  private readonly langSel: HTMLSelectElement;
  private readonly findBar: HTMLDivElement;
  private engine!: CodeEditingEngine;
  private prefs: CodePrefs;
  private lang: string;
  private matches: number[] = [];
  private matchIdx = -1;

  constructor(code: string, lang: string, prefs: CodePrefs, private readonly onChange: () => void, private readonly onExit: (w: CodeBlockWidget) => void, private readonly onRemove: (w: CodeBlockWidget) => void) {
    this.prefs = { ...prefs };
    this.lang = getLanguage(lang).id;
    this.root = h("div", "sr-code-widget", { contenteditable: "false", "data-lang": this.lang, role: "group", "aria-label": "Code block" });

    const head = h("div", "sr-code-head");
    this.langSel = h("select", "sr-code-lang", { "aria-label": "Language" });
    LANGUAGES.forEach((l) => { const o = h("option"); o.value = l.id; o.textContent = l.label; this.langSel.appendChild(o); });
    this.langSel.value = this.lang;
    this.langSel.addEventListener("change", () => { this.setLanguage(this.langSel.value); this.onChange(); });
    head.appendChild(this.langSel);

    const btn = (label: string, title: string, fn: () => void, extra = "") => {
      const b = h("button", `sr-code-btn ${extra}`.trim(), { type: "button", title, "aria-label": title });
      b.textContent = label;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", fn);
      head.appendChild(b);
      return b;
    };
    btn("✦ Format", "Format code (Shift+Alt+F)", () => this.formatNow(), "sr-code-format");
    const indentBtn = btn(this.indentLabel(), "Indent width (2 / 4 / tab)", () => {
      this.prefs.indent = this.prefs.indent === "2" ? "4" : this.prefs.indent === "4" ? "tab" : "2";
      indentBtn.textContent = this.indentLabel();
      this.rebuildEngine();
    });
    btn("#", "Line numbers", () => this.apply({ lineNumbers: !this.prefs.lineNumbers }));
    btn("↵", "Word wrap", () => this.apply({ wrap: !this.prefs.wrap }));
    btn("·", "Show whitespace", () => this.apply({ whitespace: !this.prefs.whitespace }));
    btn("◐", "Toggle theme", () => this.apply({ theme: this.prefs.theme === "dark" ? "light" : "dark" }));
    btn("⌕", "Find & replace", () => this.toggleFind());
    btn("⧉", "Copy code", () => {
      const done = () => { copyBtn.textContent = "✓"; setTimeout(() => (copyBtn.textContent = "⧉"), 1200); };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(this.ta.value).then(done, () => this.fallbackCopy(done));
      else this.fallbackCopy(done);
    });
    const copyBtn = head.lastElementChild as HTMLButtonElement;
    btn("⌫", "Clear code", () => { this.setCode(""); this.onChange(); this.ta.focus(); });
    btn("✕", "Delete code block", () => this.onRemove(this), "sr-code-del");
    this.root.appendChild(head);

    this.findBar = h("div", "sr-code-find");
    this.findBar.hidden = true;
    this.buildFindBar();
    this.root.appendChild(this.findBar);

    const body = h("div", "sr-code-body");
    this.gutter = h("div", "sr-code-gutter", { "aria-hidden": "true" });
    const stack = h("div", "sr-code-stack");
    this.lineHl = h("div", "sr-code-line-hl", { "aria-hidden": "true" });
    this.hl = h("pre", "sr-code-hl", { "aria-hidden": "true" });
    this.ta = h("textarea", "sr-code-input", { spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": "Code editor", wrap: "off" });
    stack.append(this.lineHl, this.hl, this.ta);
    body.append(this.gutter, stack);
    this.root.appendChild(body);

    this.rebuildEngine();
    this.wire();
    this.setCode(code);
    this.applyPrefs();
  }

  // --- public API -----------------------------------------------------------
  get code(): string { return this.ta.value; }
  get language(): string { return this.lang; }
  focus(): void { this.ta.focus(); }
  setPrefs(p: Partial<CodePrefs>): void { this.apply(p); }
  get currentPrefs(): CodePrefs { return { ...this.prefs }; }

  setLanguage(id: string): void {
    this.lang = getLanguage(id).id;
    this.langSel.value = this.lang;
    this.root.setAttribute("data-lang", this.lang);
    this.rebuildEngine();
    this.render();
  }

  /** One-click format of the whole block, in the block's language (guessed when it is plain text). */
  formatNow(): void {
    const indent = this.prefs.indent === "tab" ? "\t" : " ".repeat(Number(this.prefs.indent));
    const res = formatCode(this.ta.value, this.lang, { indent });
    if (res.lang !== this.lang) this.setLanguage(res.lang);
    if (res.code !== this.ta.value) {
      this.ta.focus();
      this.ta.select();
      // insertText keeps the browser's native undo (Ctrl+Z) working after a format.
      if (!document.execCommand("insertText", false, res.code)) { this.setCode(res.code); }
      this.render();
    }
    this.onChange();
    this.ta.focus();
  }

  setCode(code: string): void {
    this.ta.value = code;
    this.render();
  }

  // --- internals ------------------------------------------------------------
  private indentLabel(): string { return this.prefs.indent === "tab" ? "Tab" : `${this.prefs.indent}sp`; }
  private rebuildEngine(): void {
    const indent = this.prefs.indent === "tab" ? "\t" : " ".repeat(Number(this.prefs.indent));
    this.engine = new CodeEditingEngine({ indent, lang: getLanguage(this.lang) });
    this.ta.style.tabSize = this.prefs.indent === "tab" ? "4" : this.prefs.indent;
    this.hl.style.tabSize = this.ta.style.tabSize;
  }
  private apply(p: Partial<CodePrefs>): void { this.prefs = { ...this.prefs, ...p }; this.applyPrefs(); }
  private applyPrefs(): void {
    this.root.dataset.theme = this.prefs.theme;
    this.root.classList.toggle("sr-wrap", this.prefs.wrap);
    this.root.classList.toggle("sr-ws", this.prefs.whitespace);
    this.gutter.style.display = this.prefs.lineNumbers ? "" : "none";
    this.ta.setAttribute("wrap", this.prefs.wrap ? "soft" : "off");
    this.render();
  }

  private fallbackCopy(done: () => void): void {
    this.ta.select();
    try { document.execCommand("copy"); done(); } catch { /* ignore */ }
  }

  private state(): EditState { return { value: this.ta.value, start: this.ta.selectionStart, end: this.ta.selectionEnd }; }

  /** Applies `next` using insertText so the browser's native undo keeps working. */
  private commit(next: EditState): void {
    const old = this.ta.value;
    if (next.value !== old) {
      let p = 0;
      const max = Math.min(old.length, next.value.length);
      while (p < max && old[p] === next.value[p]) p += 1;
      let s = 0;
      while (s < max - p && old[old.length - 1 - s] === next.value[next.value.length - 1 - s]) s += 1;
      this.ta.setSelectionRange(p, old.length - s);
      const repl = next.value.slice(p, next.value.length - s);
      let ok = false;
      try { ok = repl ? document.execCommand("insertText", false, repl) : document.execCommand("delete"); } catch { ok = false; }
      if (!ok || this.ta.value !== next.value) this.ta.value = next.value;
    }
    this.ta.setSelectionRange(next.start, next.end);
    this.render();
    this.onChange();
  }

  private wire(): void {
    const ta = this.ta;
    ta.addEventListener("input", () => { this.render(); this.onChange(); });
    ta.addEventListener("scroll", () => { ta.scrollTop = 0; ta.scrollLeft = 0; });
    ["keyup", "click", "focus"].forEach((ev) => ta.addEventListener(ev, () => this.updateLineHl()));
    ta.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.isComposing) return;
      if (e.key === "Tab") { e.preventDefault(); this.commit(this.engine.tab(this.state(), e.shiftKey)); return; }
      if (e.key === "Enter" && !mod && !e.shiftKey) { e.preventDefault(); this.commit(this.engine.enter(this.state())); return; }
      if (e.key === "Backspace" && !mod) { const r = this.engine.backspace(this.state()); if (r) { e.preventDefault(); this.commit(r); } return; }
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); this.formatNow(); return; }
      if (mod && e.key === "/") { e.preventDefault(); this.commit(this.engine.toggleComment(this.state())); return; }
      if (mod && e.key.toLowerCase() === "f") { e.preventDefault(); this.toggleFind(true); return; }
      if (e.key === "Escape") { e.preventDefault(); this.onExit(this); return; }
      if (!mod && !e.altKey && e.key.length === 1) {
        const r = this.engine.type(this.state(), e.key);
        if (r) { e.preventDefault(); this.commit(r); }
      }
    });
    // Stop the surrounding editor reacting to code-editor key events.
    ["keydown", "keyup", "keypress", "beforeinput", "input", "paste", "cut", "copy"].forEach((t) => ta.addEventListener(t, (e) => e.stopPropagation()));
    ta.addEventListener("paste", (e) => e.stopPropagation());
  }

  private render(): void {
    const code = this.ta.value;
    const lines = code.split("\n");
    const tokens = getTokenizer(this.lang).tokenize(code);
    const frag = document.createDocumentFragment();
    for (const t of tokens) {
      const span = document.createElement("span");
      if (t.type !== "plain") span.className = `tk-${t.type}`;
      span.textContent = this.prefs.whitespace ? t.text.replace(/ /g, "·").replace(/\t/g, "→\t") : t.text;
      frag.appendChild(span);
    }
    frag.appendChild(document.createTextNode("\n"));
    this.hl.replaceChildren(frag);
    let nums = "";
    for (let i = 1; i <= lines.length; i += 1) nums += i + "\n";
    this.gutter.textContent = nums;
    this.root.setAttribute("data-code", code);
    this.ta.style.height = `${this.hl.offsetHeight || lines.length * 20 + 16}px`;
    requestAnimationFrame(() => { this.ta.style.height = `${this.hl.offsetHeight}px`; });
    this.updateLineHl();
  }

  private updateLineHl(): void {
    if (this.prefs.wrap) { this.lineHl.style.display = "none"; return; }
    const line = this.ta.value.slice(0, this.ta.selectionStart).split("\n").length - 1;
    this.lineHl.style.display = "";
    this.lineHl.style.top = `calc(var(--code-pad, 10px) + ${line} * var(--code-lh, 20px))`;
  }

  // --- find & replace ---------------------------------------------------------
  private buildFindBar(): void {
    const q = h("input", "sr-code-q", { placeholder: "Find", "aria-label": "Find in code" });
    const r = h("input", "sr-code-q", { placeholder: "Replace", "aria-label": "Replace with" });
    const info = h("span", "sr-code-info");
    const mk = (t: string, fn: () => void) => { const b = h("button", "sr-code-btn", { type: "button" }); b.textContent = t; b.addEventListener("mousedown", (e) => e.preventDefault()); b.addEventListener("click", fn); return b; };
    const refresh = () => { this.matches = CodeEditingEngine.findAll(this.ta.value, q.value); info.textContent = q.value ? `${this.matches.length} found` : ""; if (this.matchIdx >= this.matches.length) this.matchIdx = -1; };
    const go = (d: number) => {
      refresh();
      if (!this.matches.length) return;
      this.matchIdx = (this.matchIdx + d + this.matches.length) % this.matches.length;
      const p = this.matches[this.matchIdx];
      this.ta.focus();
      this.ta.setSelectionRange(p, p + q.value.length);
    };
    q.addEventListener("input", () => { this.matchIdx = -1; refresh(); });
    q.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); go(e.shiftKey ? -1 : 1); } if (e.key === "Escape") this.toggleFind(false); });
    r.addEventListener("keydown", (e) => e.stopPropagation());
    const replaceOne = () => {
      refresh();
      const p = this.matches[this.matchIdx];
      if (p === undefined) return go(1);
      const v = this.ta.value;
      this.commit({ value: v.slice(0, p) + r.value + v.slice(p + q.value.length), start: p + r.value.length, end: p + r.value.length });
      go(1);
    };
    const replaceAll = () => {
      if (!q.value) return;
      const v = this.ta.value;
      const parts = v.split(q.value);
      if (parts.length > 1) this.commit({ value: parts.join(r.value), start: 0, end: 0 });
      refresh();
    };
    this.findBar.append(q, mk("↑", () => go(-1)), mk("↓", () => go(1)), r, mk("Replace", replaceOne), mk("All", replaceAll), info);
  }
  private toggleFind(force?: boolean): void {
    this.findBar.hidden = force === undefined ? !this.findBar.hidden : !force;
    if (!this.findBar.hidden) (this.findBar.querySelector("input") as HTMLInputElement).focus();
    else this.ta.focus();
  }
}
