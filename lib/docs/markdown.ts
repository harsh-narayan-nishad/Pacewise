/**
 * Small, dependency-free Markdown -> HTML renderer for the project's own docs.
 * Everything is HTML-escaped first, so the output is safe to inject: the only tags that can
 * appear are the ones produced here. Supports headings, paragraphs, bold / italic / inline code,
 * links, fenced code, blockquotes, horizontal rules, tables and nested lists.
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

    const fence = line.match(/^\s*```+\s*([\w-]*)/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html.push(`<pre data-lang="${escapeHtml(fence[1])}"><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const level = h[1].length;
      html.push(`<h${level} id="${slugify(h[2])}">${inline(h[2], opts)}</h${level}>`);
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
