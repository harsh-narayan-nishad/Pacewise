import { HtmlParser } from "@/lib/editor/html/HtmlParser";
import { HtmlSerializer } from "@/lib/editor/html/HtmlSerializer";
import {
  FRAGMENT_TAG,
  HtmlElement,
  HtmlNode,
  elementNode,
  isText,
  parseStyle,
  styleToString,
  textNode,
} from "@/lib/editor/html/HtmlNode";
import {
  ALLOWED_DATA_ATTRS,
  ALLOWED_TAGS,
  CLASS_PATTERN,
  DROP_WITH_CONTENT,
  GLOBAL_ATTRS,
  MAX_NESTING_DEPTH,
  StylePolicy,
  TAG_ATTRS,
  isSafeUrl,
} from "@/lib/editor/html/SanitizePolicy";

/** Legacy presentational tags (Word, old Google Docs) mapped to their CSS
 *  equivalents instead of being thrown away — so pasted formatting survives. */
const SIZE_MAP: Record<string, string> = {
  "1": "10px", "2": "13px", "3": "16px", "4": "18px", "5": "24px", "6": "32px", "7": "48px",
};

/**
 * White-list HTML sanitizer.
 *
 * Takes untrusted HTML and returns HTML that contains only the tags,
 * attributes, classes, CSS properties and URL schemes the editor itself
 * produces. Idempotent: `sanitize(sanitize(x)) === sanitize(x)`.
 *
 * Collaborators are injected (Dependency Inversion) so a test or a future
 * stricter policy can substitute them.
 */
export class HtmlSanitizer {
  constructor(
    private readonly parser: HtmlParser = new HtmlParser(),
    private readonly serializer: HtmlSerializer = new HtmlSerializer(),
    private readonly styles: StylePolicy = new StylePolicy()
  ) {}

  sanitize(html: string): string {
    return this.serializer.serialize(this.sanitizeTree(this.parser.parse(html)));
  }

  sanitizeTree(root: HtmlElement): HtmlElement {
    const out = elementNode(FRAGMENT_TAG);
    out.children = this.cleanChildren(root.children, 0);
    return out;
  }

  private cleanChildren(nodes: readonly HtmlNode[], depth: number): HtmlNode[] {
    const out: HtmlNode[] = [];
    for (const node of nodes) {
      const cleaned = this.cleanNode(node, depth);
      for (const c of cleaned) {
        const last = out[out.length - 1];
        if (isText(c) && last && isText(last)) last.value += c.value;
        else out.push(c);
      }
    }
    return out;
  }

  /** Returns 0..n nodes: 0 = dropped, 1 = kept, n = unwrapped children. */
  private cleanNode(node: HtmlNode, depth: number): HtmlNode[] {
    if (isText(node)) {
      // eslint-disable-next-line no-control-regex
      const v = node.value.replace(/\u0000/g, "");
      return v ? [textNode(v)] : [];
    }
    const tag = node.tag;
    if (DROP_WITH_CONTENT.has(tag)) return [];

    // Absurdly deep nesting is flattened to its text rather than recursed
    // into: protects every later recursive walk from stack exhaustion.
    if (depth >= MAX_NESTING_DEPTH) return this.flattenToText(node);

    const converted = this.convertLegacy(node);
    if (converted) return this.cleanNode(converted, depth);

    if (!ALLOWED_TAGS.has(tag)) {
      // html/body/font/center/unknown: keep content, lose the wrapper.
      return this.cleanChildren(node.children, depth + 1);
    }

    const el = elementNode(tag, this.cleanAttrs(node), this.cleanChildren(node.children, depth + 1));
    return [el];
  }

  private flattenToText(node: HtmlElement): HtmlNode[] {
    const parts: string[] = [];
    const visit = (n: HtmlNode) => {
      if (isText(n)) parts.push(n.value);
      else if (!DROP_WITH_CONTENT.has(n.tag)) n.children.forEach(visit);
    };
    visit(node);
    const text = parts.join("");
    return text ? [textNode(text)] : [];
  }

  private convertLegacy(node: HtmlElement): HtmlElement | null {
    if (node.tag === "font") {
      const style = parseStyle(node.attrs.style);
      if (node.attrs.color) style.color = node.attrs.color;
      if (node.attrs.face) style["font-family"] = node.attrs.face;
      const size = node.attrs.size ? SIZE_MAP[node.attrs.size.trim()] : undefined;
      if (size) style["font-size"] = size;
      return elementNode("span", { style: styleToString(style) }, node.children);
    }
    if (node.tag === "center") {
      const style = parseStyle(node.attrs.style);
      style["text-align"] = "center";
      return elementNode("div", { style: styleToString(style) }, node.children);
    }
    return null;
  }

  private cleanAttrs(el: HtmlElement): Record<string, string> {
    const out: Record<string, string> = {};
    const tagAttrs = TAG_ATTRS[el.tag];

    for (const [name, rawValue] of Object.entries(el.attrs)) {
      const value = rawValue;
      if (name === "style") {
        const filtered = this.styles.filter(value);
        if (filtered) out.style = filtered;
      } else if (name === "class") {
        const kept = value.split(/\s+/).filter((c) => CLASS_PATTERN.test(c));
        if (kept.length) out.class = kept.join(" ");
      } else if (name.startsWith("data-")) {
        if (ALLOWED_DATA_ATTRS.has(name) && value.length <= 20_000) out[name] = value;
      } else if (GLOBAL_ATTRS.has(name) || tagAttrs?.has(name)) {
        if (name === "href") {
          if (isSafeUrl(value, "link")) out.href = value.trim();
        } else if (name === "src") {
          if (isSafeUrl(value, "image")) out.src = value.trim();
        } else if (name === "target") {
          if (value === "_blank") out.target = "_blank";
        } else if (name === "rel") {
          // always recomputed below
        } else if (name === "colspan" || name === "rowspan" || name === "span") {
          const n = parseInt(value, 10);
          if (Number.isFinite(n) && n >= 1 && n <= 1000) out[name] = String(n);
        } else if (name === "width" || name === "height") {
          const n = parseFloat(value);
          if (Number.isFinite(n) && n > 0 && n < 20_000) out[name] = String(Math.round(n));
        } else if (name === "title" || name === "alt" || name === "lang" || name === "dir" || name === "name" || name === "scope" || name === "type" || name === "start" || name === "value" || name === "reversed") {
          out[name] = value.slice(0, 2000);
        }
      }
    }

    if (el.tag === "a") {
      if (out.target === "_blank") out.rel = "noopener noreferrer";
      // An <a> with no usable href is just text-level markup; keep it inert.
    }
    if (el.tag === "img" && !out.src) {
      // An image whose source was rejected must not render a broken/blocked
      // request — drop its src entirely (the parent still sees alt text).
      delete out.src;
    }
    return out;
  }
}
