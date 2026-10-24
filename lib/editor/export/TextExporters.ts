import {
  BlockVisitor, CodeBlock, FootnotesBlock, HeadingBlock, ImageBlock, InlineRun, ListBlock, ListNumbering,
  PageBreakBlock, ParagraphBlock, RuleBlock, TableBlock, runsToPlain,
} from "@/lib/editor/model/Blocks";
import { RichDocument } from "@/lib/editor/model/RichDocument";
import { DocumentExporter, ExportResult, safeFilename } from "@/lib/editor/export/Exporter";

/** Visitor producing plain text, one string per block. */
export class PlainTextVisitor implements BlockVisitor<string> {
  paragraph(b: ParagraphBlock): string {
    return runsToPlain(b.runs);
  }
  heading(b: HeadingBlock): string {
    return runsToPlain(b.runs);
  }
  list(b: ListBlock): string {
    const n = new ListNumbering();
    return b.items
      .map((i) => {
        const pad = "  ".repeat(i.depth);
        let bullet = "•";
        if (i.checked !== undefined) bullet = i.checked ? "[x]" : "[ ]";
        else if (i.ordered) bullet = `${n.next(i.depth)}.`;
        else n.reset(i.depth);
        return `${pad}${bullet} ${runsToPlain(i.runs)}`;
      })
      .join("\n");
  }
  code(b: CodeBlock): string {
    return b.code;
  }
  image(b: ImageBlock): string {
    return b.caption || b.alt ? `[Image: ${b.caption || b.alt}]` : "[Image]";
  }
  table(b: TableBlock): string {
    return b.rows
      .map((r) => r.map((c) => c.blocks.map((x) => x.accept(this)).join(" ")).join("\t"))
      .join("\n");
  }
  rule(): string {
    return "----------";
  }
  pageBreak(): string {
    return "\f";
  }
  footnotes(b: FootnotesBlock): string {
    return b.notes.map((n, i) => `[${i + 1}] ${runsToPlain(n.runs)}`).join("\n");
  }
}

export class TextExporter implements DocumentExporter {
  readonly id = "txt";
  readonly label = "Plain text (.txt)";
  readonly extension = "txt";
  export(doc: RichDocument): ExportResult {
    const text = doc.accept(new PlainTextVisitor()).join("\n\n");
    return { filename: safeFilename(doc.meta.title, "txt"), mime: "text/plain;charset=utf-8", data: text };
  }
}

const MD_ESCAPE = /([\\`*_{}\[\]<>#|])/g;

function inlineMd(runs: readonly InlineRun[]): string {
  return runs
    .map((r) => {
      if (r.isBreak) return "  \n";
      const m = r.marks;
      if (m.code) return "`" + r.text.replace(/`/g, "'") + "`";
      let t = r.text.replace(MD_ESCAPE, "\\$1");
      if (m.math) t = "$" + m.math + "$";
      if (m.bold) t = `**${t}**`;
      if (m.italic) t = `*${t}*`;
      if (m.strike) t = `~~${t}~~`;
      if (m.underline && !m.link) t = `<u>${t}</u>`;
      if (m.sub) t = `<sub>${t}</sub>`;
      if (m.sup) t = m.footnote ? `[^${m.footnote}]` : `<sup>${t}</sup>`;
      if (m.link) t = `[${t}](${m.link.replace(/\)/g, "%29")})`;
      return t;
    })
    .join("");
}

export class MarkdownVisitor implements BlockVisitor<string> {
  paragraph(b: ParagraphBlock): string {
    const t = inlineMd(b.runs);
    if (b.style === "title") return `# ${t}`;
    if (b.style === "subtitle") return `## ${t}`;
    if (b.style === "quote") return t.split("\n").map((l) => `> ${l}`).join("\n");
    return t;
  }
  heading(b: HeadingBlock): string {
    return `${"#".repeat(b.level)} ${inlineMd(b.runs)}`;
  }
  list(b: ListBlock): string {
    const n = new ListNumbering();
    return b.items
      .map((i) => {
        const pad = "  ".repeat(i.depth);
        let bullet = "-";
        if (i.ordered) bullet = `${n.next(i.depth)}.`;
        else n.reset(i.depth);
        const box = i.checked === undefined ? "" : i.checked ? "[x] " : "[ ] ";
        return `${pad}${bullet} ${box}${inlineMd(i.runs)}`;
      })
      .join("\n");
  }
  code(b: CodeBlock): string {
    // Fence longer than any backtick run inside the code.
    const longest = Math.max(2, ...(b.code.match(/`+/g) ?? []).map((s) => s.length));
    const fence = "`".repeat(longest + 1);
    return `${fence}${b.language === "plaintext" ? "" : b.language}\n${b.code}\n${fence}`;
  }
  image(b: ImageBlock): string {
    return `![${b.alt.replace(/\]/g, "")}](${b.src})${b.caption ? `\n*${b.caption}*` : ""}`;
  }
  table(b: TableBlock): string {
    if (!b.rows.length) return "";
    const cell = (c: TableBlock["rows"][number][number]) =>
      c.blocks.map((x) => x.accept(this)).join(" ").replace(/\n/g, " ").replace(/\|/g, "\\|");
    const rows = b.rows.map((r) => `| ${r.map(cell).join(" | ")} |`);
    const cols = Math.max(...b.rows.map((r) => r.length));
    rows.splice(1, 0, `| ${Array(cols).fill("---").join(" | ")} |`);
    return rows.join("\n");
  }
  rule(): string {
    return "---";
  }
  pageBreak(): string {
    return "<!-- pagebreak -->";
  }
  footnotes(b: FootnotesBlock): string {
    return b.notes.map((n) => `[^${n.id}]: ${inlineMd(n.runs)}`).join("\n");
  }
}

export class MarkdownExporter implements DocumentExporter {
  readonly id = "md";
  readonly label = "Markdown (.md)";
  readonly extension = "md";
  export(doc: RichDocument): ExportResult {
    const text = doc.accept(new MarkdownVisitor()).filter((s) => s !== "").join("\n\n") + "\n";
    return { filename: safeFilename(doc.meta.title, "md"), mime: "text/markdown;charset=utf-8", data: text };
  }
}

export class HtmlExporter implements DocumentExporter {
  readonly id = "html";
  readonly label = "Web page (.html)";
  readonly extension = "html";
  export(doc: RichDocument): ExportResult {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(
      doc.meta.title
    )}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem}pre{background:#f4f4f5;padding:1rem;border-radius:8px;overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.4rem .6rem}img{max-width:100%}</style></head><body>${doc.html}</body></html>`;
    return { filename: safeFilename(doc.meta.title, "html"), mime: "text/html;charset=utf-8", data: html };
  }
}
