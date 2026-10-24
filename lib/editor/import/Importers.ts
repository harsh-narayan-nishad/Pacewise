import { RichDocument, defaultMeta } from "@/lib/editor/model/RichDocument";

export interface DocumentImporter {
  readonly id: string;
  /** Lower-case extensions this importer accepts. */
  readonly extensions: readonly string[];
  import(text: string, title: string): RichDocument;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export class TextImporter implements DocumentImporter {
  readonly id = "txt";
  readonly extensions = ["txt", "text"];
  import(text: string, title: string): RichDocument {
    const paras = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const html = paras.length ? paras.map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") : "<p></p>";
    return RichDocument.fromHtml(html, defaultMeta(title));
  }
}

/** Small CommonMark-subset converter (headings, emphasis, code, lists, quotes, links, images, tables, rules). */
export class MarkdownImporter implements DocumentImporter {
  readonly id = "md";
  readonly extensions = ["md", "markdown"];

  import(text: string, title: string): RichDocument {
    return RichDocument.fromHtml(this.toHtml(text), defaultMeta(title));
  }

  private inline(raw: string): string {
    const codes: string[] = [];
    let s = raw.replace(/`([^`]+)`/g, (_m, c: string) => {
      codes.push(`<code>${esc(c)}</code>`);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = esc(s);
    s = s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, a: string, u: string) => `<img alt="${a}" src="${u}">`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => `<a href="${u}">${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<s>$1</s>")
      .replace(/\\([\\`*_{}\[\]<>#|])/g, "$1");
    // eslint-disable-next-line no-control-regex
    return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
  }

  toHtml(md: string): string {
    const lines = md.replace(/\r\n?/g, "\n").split("\n");
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = /^(`{3,})\s*([\w+#-]*)\s*$/.exec(line);
      if (fence) {
        const buf: string[] = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith(fence[1])) buf.push(lines[i++]);
        i += 1;
        out.push(`<pre data-lang="${fence[2] || "plaintext"}"><code>${esc(buf.join("\n"))}</code></pre>`);
        continue;
      }
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        out.push(`<h${h[1].length}>${this.inline(h[2].trim())}</h${h[1].length}>`);
        i += 1;
        continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        out.push("<hr>");
        i += 1;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const buf: string[] = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
        out.push(`<blockquote><p>${this.inline(buf.join(" "))}</p></blockquote>`);
        continue;
      }
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items: string[] = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          const m = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i++])!;
          items.push(`<li>${this.inline(m[3])}</li>`);
        }
        out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
        continue;
      }
      if (/^\|.*\|\s*$/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
        const row = (l: string, tag: string) =>
          `<tr>${l.trim().replace(/^\||\|$/g, "").split("|").map((c) => `<${tag}>${this.inline(c.trim())}</${tag}>`).join("")}</tr>`;
        const rows = [row(line, "th")];
        i += 2;
        while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(row(lines[i++], "td"));
        out.push(`<table>${rows.join("")}</table>`);
        continue;
      }
      if (line.trim() === "") {
        i += 1;
        continue;
      }
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|>|`{3}|\s*([-*+]|\d+\.)\s)/.test(lines[i])) buf.push(lines[i++]);
      out.push(`<p>${buf.map((b) => this.inline(b.trim())).join("<br>")}</p>`);
    }
    return out.join("") || "<p></p>";
  }
}

export class HtmlImporter implements DocumentImporter {
  readonly id = "html";
  readonly extensions = ["html", "htm"];
  import(text: string, title: string): RichDocument {
    return RichDocument.fromHtml(text, defaultMeta(title));
  }
}

export class ImporterRegistry {
  private readonly all: DocumentImporter[];
  constructor(importers: DocumentImporter[] = [new TextImporter(), new MarkdownImporter(), new HtmlImporter()]) {
    this.all = importers;
  }
  forFilename(name: string): DocumentImporter | undefined {
    const ext = name.toLowerCase().split(".").pop() ?? "";
    return this.all.find((i) => i.extensions.includes(ext));
  }
  get accept(): string {
    return this.all.flatMap((i) => i.extensions.map((e) => `.${e}`)).join(",");
  }
}
