import {
  Align,
  Block,
  CodeBlock,
  Footnote,
  FootnotesBlock,
  HeadingBlock,
  ImageBlock,
  InlineRun,
  ListBlock,
  ListItem,
  PageBreakBlock,
  ParagraphBlock,
  ParagraphStyle,
  RuleBlock,
  RunMarks,
  TableBlock,
  TableCell,
  mergeRuns,
} from "@/lib/editor/model/Blocks";
import {
  HtmlElement,
  HtmlNode,
  findAll,
  hasClass,
  isElement,
  isText,
  parseStyle,
  textContent,
} from "@/lib/editor/html/HtmlNode";

const INLINE_TAGS: ReadonlySet<string> = new Set([
  "span", "strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "sub", "sup", "mark", "small",
  "code", "kbd", "abbr", "a",
]);

const BLOCK_CHILD_TAGS: ReadonlySet<string> = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "pre", "blockquote", "hr", "figure", "section",
]);

const ASCII_WS = /[ \t\r\n\f​]+/g;

/** Mutable scratch state for one container being flattened into blocks. */
class Ctx {
  readonly blocks: Block[] = [];
  runs: InlineRun[] = [];
  private markStack: RunMarks[] = [{}];
  pre = false;
  align?: Align;
  style: ParagraphStyle = "normal";
  lineHeight?: string;
  indentPx?: number;
  quote = 0;

  get marks(): RunMarks {
    return this.markStack[this.markStack.length - 1];
  }
  pushMarks(m: RunMarks): void {
    this.markStack.push(m);
  }
  popMarks(): void {
    if (this.markStack.length > 1) this.markStack.pop();
  }
  addText(raw: string): void {
    if (!raw) return;
    const text = this.pre || this.marks.code ? raw : raw.replace(ASCII_WS, " ");
    if (text) this.runs.push(new InlineRun(text, this.marks));
  }
  addBreak(): void {
    this.runs.push(new InlineRun("\n", {}));
  }
  resetBlockAttrs(): void {
    this.align = undefined;
    this.style = "normal";
    this.lineHeight = undefined;
    this.indentPx = undefined;
  }
}

/**
 * Flattens (sanitized) editor HTML into typed `Block`s.
 *
 * This is the single place that understands HTML-ish structure. Every
 * export format, the word counter and the reading-engine text derive from
 * its output, so a fix to "how is a nested list read" is made once.
 */
export class BlockExtractor {
  extract(root: HtmlElement): Block[] {
    return this.extractFrom(root.children);
  }

  extractFrom(children: readonly HtmlNode[]): Block[] {
    const c = new Ctx();
    this.walk(children, c);
    this.flush(c, false);
    return c.blocks;
  }

  // --- traversal -------------------------------------------------------------

  private walk(nodes: readonly HtmlNode[], c: Ctx): void {
    for (const node of nodes) {
      if (isText(node)) {
        c.addText(node.value);
        continue;
      }
      this.element(node, c);
    }
  }

  private element(el: HtmlElement, c: Ctx): void {
    const tag = el.tag;

    if (hasClass(el, "sr-math") && el.attrs["data-tex"] !== undefined) {
      c.runs.push(new InlineRun(textContent(el), { ...c.marks, math: el.attrs["data-tex"] }));
      return;
    }
    if (tag === "sup" && hasClass(el, "sr-fnref")) {
      c.runs.push(new InlineRun(textContent(el), { ...c.marks, sup: true, footnote: el.attrs["data-fn"] ?? "" }));
      return;
    }

    if (INLINE_TAGS.has(tag)) {
      c.pushMarks(this.marksFor(el, c.marks));
      this.walk(el.children, c);
      c.popMarks();
      return;
    }
    if (tag === "br") {
      c.addBreak();
      return;
    }
    if (tag === "img") {
      this.flush(c, false);
      c.blocks.push(this.image(el, undefined));
      return;
    }

    // Everything below is block-level: close whatever paragraph is open.
    this.flush(c, false);
    switch (tag) {
      case "p":
        this.paragraphLike(el, c, 0);
        break;
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
        this.paragraphLike(el, c, Number(tag[1]));
        break;
      case "div": {
        const hasBlockChild = el.children.some((ch) => isElement(ch) && BLOCK_CHILD_TAGS.has(ch.tag));
        if (hasClass(el, "sr-pagebreak")) c.blocks.push(new PageBreakBlock());
        else if (hasBlockChild) this.walk(el.children, c);
        else this.paragraphLike(el, c, 0);
        break;
      }
      case "ul":
      case "ol": {
        const items = this.listItems(el, 0);
        if (items.length) c.blocks.push(new ListBlock(items));
        break;
      }
      case "pre":
        c.blocks.push(this.code(el));
        break;
      case "table":
        c.blocks.push(this.table(el));
        break;
      case "hr":
        c.blocks.push(hasClass(el, "sr-pagebreak") ? new PageBreakBlock() : new RuleBlock());
        break;
      case "blockquote":
        c.quote += 1;
        this.walk(el.children, c);
        this.flush(c, false);
        c.quote -= 1;
        break;
      case "figure": {
        const img = findAll(el, (e) => e.tag === "img")[0];
        const cap = findAll(el, (e) => e.tag === "figcaption")[0];
        if (img) c.blocks.push(this.image(img, el, cap ? textContent(cap).trim() : undefined));
        break;
      }
      case "section":
        if (hasClass(el, "sr-footnotes")) c.blocks.push(this.footnotes(el));
        else this.walk(el.children, c);
        break;
      default:
        this.walk(el.children, c);
    }
  }

  /** A `p` / `div` / `hN`: its inline content becomes one block. */
  private paragraphLike(el: HtmlElement, c: Ctx, headingLevel: number): void {
    const prev = { align: c.align, style: c.style, lineHeight: c.lineHeight, indentPx: c.indentPx };
    const css = parseStyle(el.attrs.style);
    c.align = this.alignOf(css["text-align"]) ?? c.align;
    c.lineHeight = css["line-height"];
    const ml = css["margin-left"] ? parseFloat(css["margin-left"]) : NaN;
    c.indentPx = Number.isFinite(ml) && ml > 0 ? ml : undefined;
    if (hasClass(el, "sr-title")) c.style = "title";
    else if (hasClass(el, "sr-subtitle")) c.style = "subtitle";
    else if (c.quote > 0) c.style = "quote";

    // Inline children accumulate; a nested block flushes via `element()`.
    const marks = headingLevel ? { ...c.marks } : c.marks;
    c.pushMarks(marks);
    this.walk(el.children, c);
    c.popMarks();
    this.flush(c, true, headingLevel as 0 | 1 | 2 | 3 | 4 | 5 | 6);

    c.align = prev.align;
    c.style = prev.style;
    c.lineHeight = prev.lineHeight;
    c.indentPx = prev.indentPx;
  }

  /** Turns the pending inline runs into a block, if there is anything. */
  private flush(c: Ctx, forceEmpty: boolean, headingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): void {
    const runs = this.normalize(c.runs);
    c.runs = [];
    const blank = runs.length === 0;
    if (blank && !forceEmpty) return;
    if (headingLevel > 0) {
      if (!blank) c.blocks.push(new HeadingBlock(headingLevel as 1 | 2 | 3 | 4 | 5 | 6, runs, c.align));
      return;
    }
    const style: ParagraphStyle = c.quote > 0 && c.style === "normal" ? "quote" : c.style;
    c.blocks.push(new ParagraphBlock(runs, c.align, style, c.lineHeight, c.indentPx));
  }

  // --- inline normalisation --------------------------------------------------

  /** Trims, collapses double spaces across run boundaries, drops empties
   *  and trailing breaks, and merges neighbours with identical marks. */
  private normalize(input: readonly InlineRun[]): InlineRun[] {
    const out: InlineRun[] = [];
    let prevEndsSpace = true;
    for (const run of input) {
      if (run.isBreak) {
        const last = out[out.length - 1];
        if (last && !last.isBreak) out[out.length - 1] = last.withText(last.text.replace(/ +$/, ""));
        out.push(run);
        prevEndsSpace = true;
        continue;
      }
      let text = run.text;
      if (prevEndsSpace && !run.marks.code) text = text.replace(/^ +/, "");
      if (text === "") continue;
      out.push(run.withText(text));
      prevEndsSpace = text.endsWith(" ");
    }
    while (out.length) {
      const last = out[out.length - 1];
      if (last.isBreak) out.pop();
      else {
        const trimmed = last.marks.code ? last.text : last.text.replace(/ +$/, "");
        if (trimmed === "") out.pop();
        else {
          out[out.length - 1] = last.withText(trimmed);
          break;
        }
      }
    }
    return mergeRuns(out.filter((r) => r.text !== ""));
  }

  // --- marks -----------------------------------------------------------------

  private marksFor(el: HtmlElement, base: RunMarks): RunMarks {
    const m: Record<string, unknown> = { ...base };
    switch (el.tag) {
      case "strong": case "b": m.bold = true; break;
      case "em": case "i": m.italic = true; break;
      case "u": case "ins": m.underline = true; break;
      case "s": case "strike": case "del": m.strike = true; break;
      case "sub": m.sub = true; break;
      case "sup": m.sup = true; break;
      case "code": case "kbd": m.code = true; break;
      case "mark": m.background = "#fff59d"; break;
      case "a": if (el.attrs.href) m.link = el.attrs.href; break;
      default: break;
    }
    const css = parseStyle(el.attrs.style);
    const weight = css["font-weight"];
    if (weight) m.bold = /^(bold|bolder)$/i.test(weight) || (/^\d+$/.test(weight) && parseInt(weight, 10) >= 600);
    const fstyle = css["font-style"];
    if (fstyle) m.italic = /^(italic|oblique)$/i.test(fstyle);
    const deco = `${css["text-decoration"] ?? ""} ${css["text-decoration-line"] ?? ""}`;
    if (/underline/.test(deco)) m.underline = true;
    if (/line-through/.test(deco)) m.strike = true;
    const va = css["vertical-align"];
    if (va === "sub") m.sub = true;
    if (va === "super") m.sup = true;
    if (css.color) m.color = css.color;
    if (css["background-color"] && css["background-color"] !== "transparent") m.background = css["background-color"];
    if (css["font-family"]) m.fontFamily = css["font-family"];
    if (css["font-size"]) m.fontSize = css["font-size"];
    // Drop `false` entries so equality checks stay simple.
    for (const k of Object.keys(m)) if (m[k] === false) delete m[k];
    return m as RunMarks;
  }

  private alignOf(value: string | undefined): Align | undefined {
    switch ((value ?? "").toLowerCase()) {
      case "left": case "start": return "left";
      case "center": return "center";
      case "right": case "end": return "right";
      case "justify": return "justify";
      default: return undefined;
    }
  }

  // --- block builders --------------------------------------------------------

  private runsOf(children: readonly HtmlNode[]): InlineRun[] {
    const c = new Ctx();
    this.walk(children, c);
    return this.normalize(c.runs);
  }

  private listItems(list: HtmlElement, depth: number): ListItem[] {
    const out: ListItem[] = [];
    const ordered = list.tag === "ol";
    const isCheck = hasClass(list, "sr-check");
    for (const child of list.children) {
      if (!isElement(child) || child.tag !== "li") continue;
      const c = new Ctx();
      const nested: HtmlElement[] = [];
      const gather = (nodes: readonly HtmlNode[]) => {
        for (const n of nodes) {
          if (isElement(n) && (n.tag === "ul" || n.tag === "ol")) nested.push(n);
          else if (isElement(n) && (n.tag === "p" || n.tag === "div")) {
            if (c.runs.length) c.addBreak();
            gather(n.children);
          } else if (isText(n)) c.addText(n.value);
          else this.element(n, c);
        }
      };
      gather(child.children);
      const checkedAttr = child.attrs["data-checked"];
      out.push({
        runs: this.normalize(c.runs),
        depth,
        ordered,
        checked: isCheck || checkedAttr !== undefined ? checkedAttr === "true" : undefined,
      });
      nested.forEach((n) => out.push(...this.listItems(n, depth + 1)));
    }
    return out;
  }

  private code(pre: HtmlElement): CodeBlock {
    const lang = pre.attrs["data-lang"] ?? "plaintext";
    let code = textContent(pre);
    // A trailing newline is an artefact of <pre> serialisation, not content.
    if (code.endsWith("\n")) code = code.slice(0, -1);
    return new CodeBlock(code, lang);
  }

  private image(img: HtmlElement, figure: HtmlElement | undefined, caption?: string): ImageBlock {
    const css = parseStyle(img.attrs.style);
    const fcss = figure ? parseStyle(figure.attrs.style) : {};
    const width = parseFloat(img.attrs.width ?? css.width ?? "");
    const height = parseFloat(img.attrs.height ?? css.height ?? "");
    let align: Align | undefined;
    const declared = figure?.attrs["data-align"] ?? img.attrs["data-align"];
    if (declared === "left" || declared === "center" || declared === "right") align = declared;
    else if (css.float === "left" || fcss.float === "left") align = "left";
    else if (css.float === "right" || fcss.float === "right") align = "right";
    return new ImageBlock(
      img.attrs.src ?? "",
      img.attrs.alt ?? "",
      caption ?? img.attrs["data-caption"] ?? "",
      Number.isFinite(width) ? width : undefined,
      Number.isFinite(height) ? height : undefined,
      align,
      img.attrs["data-img-id"]
    );
  }

  private table(table: HtmlElement): TableBlock {
    const rows: TableCell[][] = [];
    const rowEls = findAll(table, (e) => e.tag === "tr");
    for (const tr of rowEls) {
      const cells: TableCell[] = [];
      for (const cell of tr.children) {
        if (!isElement(cell) || (cell.tag !== "td" && cell.tag !== "th")) continue;
        const css = parseStyle(cell.attrs.style);
        cells.push({
          blocks: this.extractFrom(cell.children),
          header: cell.tag === "th",
          colspan: Math.max(1, parseInt(cell.attrs.colspan ?? "1", 10) || 1),
          rowspan: Math.max(1, parseInt(cell.attrs.rowspan ?? "1", 10) || 1),
          background: css["background-color"],
        });
      }
      if (cells.length) rows.push(cells);
    }
    return new TableBlock(rows);
  }

  private footnotes(section: HtmlElement): FootnotesBlock {
    const notes: Footnote[] = [];
    for (const li of findAll(section, (e) => e.tag === "li")) {
      notes.push({ id: li.attrs["data-fn"] ?? String(notes.length + 1), runs: this.runsOf(li.children) });
    }
    return new FootnotesBlock(notes);
  }
}
