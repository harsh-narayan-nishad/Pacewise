import { HtmlParser } from "@/lib/editor/html/HtmlParser";
import { HtmlSanitizer } from "@/lib/editor/html/HtmlSanitizer";
import { HtmlSerializer } from "@/lib/editor/html/HtmlSerializer";
import {
  HtmlElement, HtmlNode, elementNode, isElement, parseStyle, styleToString, textContent, textNode,
} from "@/lib/editor/html/HtmlNode";
import { RichDocument } from "@/lib/editor/model/RichDocument";
import { getLanguage, getTokenizer } from "@/lib/editor/code/languages";
import { beautifyIfCollapsed } from "@/lib/editor/reader/CodeFormatter";
import { dedent, guessLanguage } from "@/lib/editor/code/CodeHeuristics";
import { ImageSrcResolver } from "@/lib/editor/reader/imageResolver";

/** "Default ink" colours (near black / near white) are dropped in the reader so
 *  author-chosen black text can never vanish on the dark theme (and the reverse).
 *  Deliberately chromatic colours (red, blue …) are kept. */
export function isNeutralColor(value: string): boolean {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  let r: number, g: number, b: number;
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(value.trim());
    if (!m) return /^(black|white|gray|grey|silver|transparent)$/i.test(value.trim());
    [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread < 24; // grey-ish: black, white and every grey in between
}

const sharedParser = new HtmlParser();
const sharedSanitizer = new HtmlSanitizer();
const sharedSerializer = new HtmlSerializer();

/**
 * Turns a RichDocument into the HTML the READER shows:
 *   - `sr-img:` references become real image sources (or a visible
 *     "image unavailable" note when the bytes are gone);
 *   - code blocks are syntax-highlighted into `sr-tk-*` spans;
 *   - neutral text/background colours are removed (theme-safe);
 *   - the result goes through the sanitizer AGAIN, so nothing this class
 *     builds can contain anything the allow-list forbids.
 * Pure function of (document, resolver): no DOM, runs under Node.
 */
export class StoryContentRenderer {
  constructor(private readonly resolveImage: ImageSrcResolver) {}

  render(doc: RichDocument): string {
    const root = sharedParser.parse(doc.html);
    root.children = this.visit(root.children);
    return sharedSerializer.serialize(sharedSanitizer.sanitizeTree(root));
  }

  private visit(nodes: readonly HtmlNode[]): HtmlNode[] {
    return nodes.map((n) => (isElement(n) ? this.element(n) : n));
  }

  private element(el: HtmlElement): HtmlNode {
    if (el.tag === "pre") return this.code(el);
    if (el.tag === "img") return this.image(el);
    if (el.attrs.style) {
      const css = parseStyle(el.attrs.style);
      for (const prop of ["color", "background-color"]) if (css[prop] && isNeutralColor(css[prop])) delete css[prop];
      const next = styleToString(css);
      if (next) el.attrs.style = next; else delete el.attrs.style;
    }
    el.children = this.visit(el.children);
    return el;
  }

  private image(img: HtmlElement): HtmlNode {
    const src = this.resolveImage(img.attrs.src ?? "");
    if (!src) {
      const note = img.attrs.alt ? `Image unavailable: ${img.attrs.alt}` : "Image unavailable";
      return elementNode("span", { class: "sr-img-missing" }, [textNode(note)]);
    }
    const attrs: Record<string, string> = { src, alt: img.attrs.alt ?? "" };
    if (img.attrs.width) attrs.width = img.attrs.width;
    if (img.attrs.height) attrs.height = img.attrs.height;
    if (img.attrs.style) attrs.style = img.attrs.style;
    return elementNode("img", attrs);
  }

  private code(pre: HtmlElement): HtmlNode {
    const raw = dedent(textContent(pre));
    let lang = getLanguage(pre.attrs["data-lang"] ?? "plaintext");
    if (lang.id === "plaintext") lang = getLanguage(guessLanguage(raw));
    const text = beautifyIfCollapsed(raw, lang.id);
    const spans: HtmlNode[] = getTokenizer(lang.id).tokenize(text).map((t) =>
      t.type === "plain" ? textNode(t.text) : elementNode("span", { class: `sr-tk-${t.type}` }, [textNode(t.text)])
    );
    return elementNode("pre", { class: "sr-code", "data-lang": lang.id }, [elementNode("code", {}, spans)]);
  }
}
