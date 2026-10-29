import { highlight, parseFenceInfo } from "./highlight";
/**
 * Small, dependency-free Markdown -> HTML renderer for the project's own docs.
 * Everything is HTML-escaped first, so the output is safe to inject: the only tags that can
 * appear are the ones produced here. Supports headings, paragraphs, bold / italic / inline code,
 * links, fenced code, blockquotes, horizontal rules, tables and nested lists.
 *
 * Writing tools (all optional, usable in any .md doc):
 *   ==important==        highlighter (yellow);  ==green:text==  ==blue:text==  ==pink:text==  ==orange:text==
 *   *italic*  **bold**  ***bold italic***  ++underline++  ~~strikethrough~~
 *   ```mermaid           a diagram that becomes an interactive viewer on the doc page
 */
export interface MarkdownOptions {
  /** Maps a link target found in the text (e.g. "OOP_ARCHITECTURE.md#x") to a real URL, or null to leave it. */
  resolveLink?: (href: string) => string | null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const slugify = (s: string) =>
  s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[`*_~]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:|mailto:|#|\/|\.{0,2}\/|[\w.-]+(\.md)?(#.*)?$)/i.test(h) && !/^\s*javascript:/i.test(h)) return h;
  return null;
}

function inline(text: string, opts: MarkdownOptions): string {
  const codes: string[] = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const raw = href.replace(/&amp;/g, "&");
    const ok = safeHref(raw);
    if (!ok) return label;
    const resolved = opts.resolveLink?.(raw) ?? ok;
    const external = /^https?:/i.test(resolved);
    return `<a href="${escapeHtml(resolved)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  out = out
    .replace(/==(?:(yellow|green|blue|pink|orange):)?(?=\S)([^=\n]+?)(?<=\S)==/g, (_m, c, t) => `<mark class="hl" data-c="${c ?? "yellow"}">${t}</mark>`)
    .replace(/\+\+(?=\S)([^+\n]+?)(?<=\S)\+\+/g, "<u>$1</u>")
    .replace(/~~(?=\S)([^~\n]+?)(?<=\S)~~/g, "<s>$1</s>")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, "$1<em>$2</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

interface ListItem { text: string; children: string[] ; ordered: boolean }

function renderList(lines: string[], opts: MarkdownOptions): string {
  // lines: raw list lines (with indentation). Group by top-level indentation.
  const base = Math.min(...lines.map((l) => l.match(/^\s*/)![0].length));
  const items: { ordered: boolean; text: string; sub: string[] }[] = [];
  for (const l of lines) {
    const indent = l.match(/^\s*/)![0].length;
    const m = l.trim().match(/^([-*+]|\d+[.)])\s+(.*)$/);
    if (indent <= base + 1 && m) items.push({ ordered: /\d/.test(m[1]), text: m[2], sub: [] });
    else if (items.length) items[items.length - 1].sub.push(l);
  }
  const tag = items[0]?.ordered ? "ol" : "ul";
  return `<${tag}>${items
    .map((it) => {
      const subItems = it.sub.filter((s) => /^\s*([-*+]|\d+[.)])\s+/.test(s));
      const cont = it.sub.filter((s) => !/^\s*([-*+]|\d+[.)])\s+/.test(s)).map((s) => s.trim()).join(" ");
      return `<li>${inline(it.text + (cont ? " " + cont : ""), opts)}${subItems.length ? renderList(it.sub.filter((s) => s.trim()), opts) : ""}</li>`;
    })
    .join("")}</${tag}>`;
}

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const splitRow = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));

export function renderMarkdown(md: string, opts: MarkdownOptions = {}): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^\s*```+\s*([\w-]*)\s*(.*)$/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      if (fence[1] === "mermaid") {
        // Becomes an interactive diagram on the doc page; the plain source stays as the no-JS fallback.
        html.push(`<div class="doc-diagram" data-diagram="${escapeHtml(buf.join("\n"))}"><pre data-lang="mermaid"><code>${escapeHtml(buf.join("\n"))}</code></pre></div>`);
        continue;
      }
      const code = buf.join("\n");
      const info = parseFenceInfo(fence[2] ?? "");
      if (!fence[1] && !info.title && !info.principle) {
        html.push(`<pre data-lang=""><code>${escapeHtml(code)}</code></pre>`);
        continue;
      }
      // A captioned code block: file path + language on top, code coloured with its indentation kept, and the principle below.
      html.push(
        `<figure class="doc-code"><figcaption data-ann-skip="1"><span class="code-path">${info.title ? escapeHtml(info.title) : ""}</span><span class="code-lang">${escapeHtml(fence[1] || "text")}</span><button type="button" class="code-copy" aria-label="Copy code">Copy</button></figcaption>` +
          `<pre data-lang="${escapeHtml(fence[1])}"><code>${highlight(code, fence[1])}</code></pre>` +
          (info.principle ? `<div class="code-principle" data-ann-skip="1"><strong>Principle</strong> ${escapeHtml(info.principle)}${info.note ? ` · ${escapeHtml(info.note)}` : ""}</div>` : "") +
          `</figure>`
      );
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const level = h[1].length;
      const id = slugify(h[2]);
      html.push(`<h${level} id="${id}">${inline(h[2], opts)}${level >= 2 ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : ""}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { html.push("<hr />"); i++; continue; }
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      html.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c, opts)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c, opts)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      html.push(`<blockquote>${renderMarkdown(buf.join("\n"), opts)}</blockquote>`);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) buf.push(lines[i++]);
      html.push(renderList(buf, opts));
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,6}\s|>|([-*+]|\d+[.)])\s)/.test(lines[i]) && !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))) para.push(lines[i++].trim());
    if (para.length) html.push(`<p>${inline(para.join(" "), opts)}</p>`);
    else i++;
  }
  return html.join("\n");
}

/** First "# Heading" of a document, used as its title. */
export function firstHeading(md: string, fallback: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/[`*_]/g, "").trim() : fallback;
}

export interface Heading { level: number; text: string; id: string }

/** h2 / h3 headings (outside code fences), for the "On this page" list. */
export function extractHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  let fenced = false;
  for (const line of md.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = line.match(/^(#{2,3})\s+(.*?)\s*#*\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[`*_=+~]/g, "").trim(), id: slugify(m[2]) });
  }
  return out;
}

/** Minutes to read at ~200 words a minute (code and diagrams excluded). */
export function readingMinutes(md: string): number {
  const words = md.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
