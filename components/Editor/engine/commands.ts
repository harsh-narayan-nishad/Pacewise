import { EditorSurface } from "@/components/Editor/engine/EditorSurface";
import { isSafeUrl } from "@/lib/editor/html/SanitizePolicy";
import { TableOps } from "@/components/Editor/engine/TableOps";

/** Command pattern: each ribbon action is an object with an id, so the UI,
 *  keyboard shortcuts and tests all invoke the same code path. */
export interface EditorCommand {
  readonly id: string;
  run(surface: EditorSurface, arg?: string): void;
}

class ExecCommand implements EditorCommand {
  constructor(readonly id: string, private readonly name: string, private readonly value?: string) {}
  run(s: EditorSurface, arg?: string): void { s.exec(this.name, arg ?? this.value); }
}

class FnCommand implements EditorCommand {
  constructor(readonly id: string, private readonly fn: (s: EditorSurface, arg?: string) => void) {}
  run(s: EditorSurface, arg?: string): void { this.fn(s, arg); }
}

/** Replace the `<font size=7>` marker execCommand leaves with an exact CSS value. */
function applySpanStyle(s: EditorSurface, prop: "font-size" | "font-family", value: string): void {
  s.memento.restore();
  s.record();
  const marker = prop === "font-size" ? "xxx-large" : value;
  if (prop === "font-size") document.execCommand("fontSize", false, "7");
  else document.execCommand("fontName", false, value);
  s.el.querySelectorAll<HTMLElement>("font[size='7'], span").forEach((n) => {
    if (n.tagName === "FONT") {
      const span = document.createElement("span");
      span.style.setProperty(prop, value);
      while (n.firstChild) span.appendChild(n.firstChild);
      n.replaceWith(span);
    } else if (prop === "font-size" && n.style.fontSize === marker) {
      n.style.fontSize = value;
    }
  });
  s.afterEdit();
}

const BLOCK_TAG: Record<string, string> = { p: "p", h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", quote: "blockquote", title: "p", subtitle: "p" };

const cmd = (c: EditorCommand): [string, EditorCommand] => [c.id, c];

export class CommandRegistry {
  private readonly map = new Map<string, EditorCommand>([
    cmd(new ExecCommand("bold", "bold")), cmd(new ExecCommand("italic", "italic")), cmd(new ExecCommand("underline", "underline")),
    cmd(new ExecCommand("strike", "strikeThrough")), cmd(new ExecCommand("sub", "subscript")), cmd(new ExecCommand("sup", "superscript")),
    cmd(new ExecCommand("alignLeft", "justifyLeft")), cmd(new ExecCommand("alignCenter", "justifyCenter")),
    cmd(new ExecCommand("alignRight", "justifyRight")), cmd(new ExecCommand("alignJustify", "justifyFull")),
    cmd(new ExecCommand("ol", "insertOrderedList")), cmd(new ExecCommand("ul", "insertUnorderedList")),
    cmd(new ExecCommand("indent", "indent")), cmd(new ExecCommand("outdent", "outdent")),
    cmd(new ExecCommand("color", "foreColor")), cmd(new ExecCommand("highlight", "hiliteColor")),
    cmd(new ExecCommand("hr", "insertHorizontalRule")),
    cmd(new FnCommand("undo", (s) => s.undo())), cmd(new FnCommand("redo", (s) => s.redo())),
    cmd(new FnCommand("clearFormat", (s) => { s.exec("removeFormat"); s.exec("formatBlock", "p"); s.styleBlocks((b) => { b.removeAttribute("style"); b.removeAttribute("class"); }); })),
    cmd(new FnCommand("fontSize", (s, v) => v && applySpanStyle(s, "font-size", /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v))),
    cmd(new FnCommand("fontFamily", (s, v) => v && applySpanStyle(s, "font-family", v))),
    cmd(new FnCommand("blockStyle", (s, v = "p") => {
      s.memento.restore();
      s.exec("formatBlock", BLOCK_TAG[v] ?? "p");
      s.styleBlocks((b) => { b.classList.remove("sr-title", "sr-subtitle"); if (v === "title") b.classList.add("sr-title"); if (v === "subtitle") b.classList.add("sr-subtitle"); if (!b.getAttribute("class")) b.removeAttribute("class"); });
    })),
    cmd(new FnCommand("checklist", (s) => {
      s.exec("insertUnorderedList");
      s.transact(() => s.selectedBlocks().forEach((li) => {
        const ul = li.closest("ul");
        if (!ul) return;
        ul.classList.toggle("sr-check");
        ul.querySelectorAll(":scope > li").forEach((x) => ul.classList.contains("sr-check") ? x.setAttribute("data-checked", x.getAttribute("data-checked") ?? "false") : x.removeAttribute("data-checked"));
      }));
    })),
    cmd(new FnCommand("lineHeight", (s, v) => s.styleBlocks((b) => { if (v) b.style.lineHeight = v; else b.style.removeProperty("line-height"); }))),
    cmd(new FnCommand("spaceBefore", (s, v) => s.styleBlocks((b) => { b.style.marginTop = `${Number(v) || 0}px`; }))),
    cmd(new FnCommand("spaceAfter", (s, v) => s.styleBlocks((b) => { b.style.marginBottom = `${Number(v) || 0}px`; }))),
    cmd(new FnCommand("paragraphBg", (s, v) => s.styleBlocks((b) => { if (v) b.style.backgroundColor = v; else b.style.removeProperty("background-color"); }))),
    cmd(new FnCommand("link", (s, url) => {
      if (!url) { s.exec("unlink"); return; }
      const href = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#") ? url : `https://${url}`;
      if (!isSafeUrl(href, "link")) { return; }
      s.exec("createLink", href);
      s.el.querySelectorAll<HTMLAnchorElement>(`a[href="${CSS.escape(href)}"]`).forEach((a) => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
      s.afterEdit();
    })),
    cmd(new FnCommand("pageBreak", (s) => s.insertHtml('<hr class="sr-pagebreak"><p><br></p>'))),
    cmd(new FnCommand("symbol", (s, v) => v && s.insertText(v))),
    cmd(new FnCommand("math", (s, v) => v && s.insertMath(v))),
    cmd(new FnCommand("footnote", (s, v) => v && s.insertFootnote(v))),
    cmd(new FnCommand("codeBlock", (s, v) => s.insertCodeBlock(v || "plaintext"))),
    cmd(new FnCommand("toCode", (s, v) => s.convertSelectionToCode(v || "plaintext"))),
    cmd(new FnCommand("table", (s, v) => { const [r, c] = (v ?? "3x3").split("x").map(Number); s.insertHtml(TableOps.create(r || 3, c || 3, true)); })),
    cmd(new FnCommand("tableOp", (s, v) => {
      const cell = s.currentCell();
      const table = cell?.closest("table") as HTMLTableElement | null;
      if (!cell || !table) return;
      s.transact(() => {
        switch (v) {
          case "rowAbove": TableOps.addRow(table, cell, false); break;
          case "rowBelow": TableOps.addRow(table, cell, true); break;
          case "colLeft": TableOps.addColumn(table, cell, false); break;
          case "colRight": TableOps.addColumn(table, cell, true); break;
          case "delRow": TableOps.deleteRow(table, cell); break;
          case "delCol": TableOps.deleteColumn(table, cell); break;
          case "mergeRight": TableOps.mergeRight(table, cell); break;
          case "mergeDown": TableOps.mergeDown(table, cell); break;
          case "split": TableOps.split(table, cell); break;
          case "delTable": table.remove(); break;
          case "borders": table.classList.toggle("sr-noborder"); break;
          default: break;
        }
      });
    })),
    cmd(new FnCommand("cellBg", (s, v) => { const c = s.currentCell(); if (c) s.transact(() => TableOps.setCellBackground(c, v || null)); })),
    cmd(new FnCommand("imageProp", (s, v = "") => {
      const img = s.image;
      if (!img) return;
      const [k, ...rest] = v.split(":");
      const val = rest.join(":");
      const fig = img.closest("figure");
      s.transact(() => {
        if (k === "align" && fig) fig.setAttribute("data-align", val);
        else if (k === "alt") img.alt = val;
        else if (k === "caption" && fig) { const cap = fig.querySelector("figcaption"); if (cap) cap.textContent = val; }
        else if (k === "border") { if (img.style.border) img.style.removeProperty("border"); else img.style.border = "2px solid rgb(128,128,128)"; if (!img.getAttribute("style")) img.removeAttribute("style"); }
        else if (k === "margin") { img.style.margin = `${Number(val) || 0}px`; }
        else if (k === "width") { const w = Number(val); if (w > 0) { const r = img.getBoundingClientRect(); img.setAttribute("height", String(Math.round((w / (r.width || w)) * r.height))); img.setAttribute("width", String(Math.round(w))); } }
        else if (k === "delete" && fig) { fig.remove(); s.selectImage(null); }
      });
    })),
  ]);

  run(id: string, surface: EditorSurface, arg?: string): void {
    const c = this.map.get(id);
    if (!c) throw new Error(`Unknown editor command "${id}"`);
    c.run(surface, arg);
  }
  has(id: string): boolean { return this.map.has(id); }
}
