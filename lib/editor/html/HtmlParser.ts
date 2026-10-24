import { decodeEntities } from "@/lib/editor/html/entities";
import {
  FRAGMENT_TAG,
  HtmlElement,
  VOID_TAGS,
  elementNode,
  textNode,
} from "@/lib/editor/html/HtmlNode";

/** Elements whose content is raw text, not markup (so `<` inside is data). */
const RAW_TEXT_TAGS: ReadonlySet<string> = new Set(["script", "style", "textarea", "title"]);

/** Opening `key` implicitly closes any open element listed for it — the
 *  small slice of the HTML "optional end tag" rules real pasted content
 *  relies on (`<li>a<li>b`, `<td>a<td>b`, `<p>a<p>b`). */
const IMPLIED_CLOSE: Record<string, readonly string[]> = {
  li: ["li"],
  p: ["p"],
  tr: ["td", "th", "tr"],
  td: ["td", "th"],
  th: ["td", "th"],
  thead: ["tbody", "tfoot"],
  tbody: ["thead", "tfoot", "tbody"],
  option: ["option"],
};

const BLOCK_TAGS: ReadonlySet<string> = new Set([
  "div",
  "ul",
  "ol",
  "table",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "figure",
  "section",
]);

/**
 * Forgiving single-pass HTML parser.
 *
 * Never throws: malformed input degrades to *some* tree (stray close tags
 * are ignored, unclosed elements are closed at end of input, a lone `<`
 * becomes text). That matters because the input is often pasted from
 * Word/Google Docs or typed into the JSON tab by a human.
 *
 * It does NOT validate or sanitize — see `HtmlSanitizer`. Parsing and
 * trust are separate responsibilities.
 */
export class HtmlParser {
  parse(html: string): HtmlElement {
    const root = elementNode(FRAGMENT_TAG);
    const stack: HtmlElement[] = [root];
    const top = (): HtmlElement => stack[stack.length - 1];
    const n = html.length;
    let i = 0;

    const pushText = (value: string) => {
      if (!value) return;
      const parent = top();
      const last = parent.children[parent.children.length - 1];
      if (last && last.type === "text") last.value += value;
      else parent.children.push(textNode(value));
    };

    while (i < n) {
      const lt = html.indexOf("<", i);
      if (lt === -1) {
        pushText(decodeEntities(html.slice(i)));
        break;
      }
      if (lt > i) pushText(decodeEntities(html.slice(i, lt)));
      i = lt;

      // <!-- comment -->
      if (html.startsWith("<!--", i)) {
        const end = html.indexOf("-->", i + 4);
        i = end === -1 ? n : end + 3;
        continue;
      }
      // <!doctype ...>, <?xml ...?>, <![CDATA[ ... ]]>
      if (html[i + 1] === "!" || html[i + 1] === "?") {
        const end = html.indexOf(">", i + 2);
        i = end === -1 ? n : end + 1;
        continue;
      }

      // </tag>
      if (html[i + 1] === "/") {
        const m = /^<\/([a-zA-Z][^\s>/]*)[^>]*>/.exec(html.slice(i, i + 256));
        if (!m) {
          pushText("<");
          i += 1;
          continue;
        }
        this.closeTag(stack, m[1].toLowerCase());
        i += m[0].length;
        continue;
      }

      // <tag attr=...>
      const nameMatch = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(i, i + 64));
      if (!nameMatch) {
        pushText("<");
        i += 1;
        continue;
      }
      const tag = nameMatch[1].toLowerCase();
      const parsed = this.parseAttributes(html, i + nameMatch[0].length);
      i = parsed.end;

      this.applyImpliedClose(stack, tag);
      const el = elementNode(tag, parsed.attrs);
      top().children.push(el);

      if (VOID_TAGS.has(tag) || parsed.selfClosing) continue;

      if (RAW_TEXT_TAGS.has(tag)) {
        const closeRe = new RegExp(`</${tag}\\s*>`, "i");
        const rest = html.slice(i);
        const cm = closeRe.exec(rest);
        const rawEnd = cm ? i + cm.index : n;
        const raw = html.slice(i, rawEnd);
        if (raw) el.children.push(textNode(tag === "textarea" || tag === "title" ? decodeEntities(raw) : raw));
        i = cm ? rawEnd + cm[0].length : n;
        continue;
      }
      stack.push(el);
    }
    return root;
  }

  private applyImpliedClose(stack: HtmlElement[], opening: string): void {
    const closes = IMPLIED_CLOSE[opening];
    // A block-level element cannot live inside an open <p>.
    if (BLOCK_TAGS.has(opening) || opening === "table") {
      while (stack.length > 1 && stack[stack.length - 1].tag === "p") stack.pop();
    }
    if (!closes) return;
    while (stack.length > 1) {
      const t = stack[stack.length - 1].tag;
      if (!closes.includes(t)) break;
      stack.pop();
    }
  }

  private closeTag(stack: HtmlElement[], tag: string): void {
    for (let k = stack.length - 1; k >= 1; k -= 1) {
      if (stack[k].tag === tag) {
        stack.length = k;
        return;
      }
    }
    // No matching open element: the stray close tag is ignored.
  }

  private parseAttributes(
    html: string,
    start: number
  ): { attrs: Record<string, string>; end: number; selfClosing: boolean } {
    const attrs: Record<string, string> = {};
    const n = html.length;
    let i = start;
    let selfClosing = false;
    // Hard cap so a pathological tag cannot make this loop unbounded work.
    const limit = Math.min(n, start + 8192);

    while (i < limit) {
      while (i < limit && /\s/.test(html[i])) i += 1;
      if (i >= limit) break;
      const ch = html[i];
      if (ch === ">") {
        i += 1;
        return { attrs, end: i, selfClosing };
      }
      if (ch === "/") {
        selfClosing = html[i + 1] === ">";
        i += 1;
        continue;
      }
      const nameStart = i;
      while (i < limit && !/[\s=/>]/.test(html[i])) i += 1;
      const name = html.slice(nameStart, i).toLowerCase();
      while (i < limit && /\s/.test(html[i])) i += 1;
      let value = "";
      if (html[i] === "=") {
        i += 1;
        while (i < limit && /\s/.test(html[i])) i += 1;
        const q = html[i];
        if (q === '"' || q === "'") {
          const close = html.indexOf(q, i + 1);
          const stop = close === -1 ? limit : Math.min(close, limit);
          value = html.slice(i + 1, stop);
          i = close === -1 ? limit : stop + 1;
        } else {
          const vs = i;
          while (i < limit && !/[\s>]/.test(html[i])) i += 1;
          value = html.slice(vs, i);
        }
      }
      if (name && !(name in attrs)) attrs[name] = decodeEntities(value);
    }
    // Unterminated tag: treat everything consumed as the tag.
    return { attrs, end: Math.min(i, n), selfClosing };
  }
}
