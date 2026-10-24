/**
 * The editor's allow-list, expressed as data + small policy objects.
 *
 * SECURITY MODEL: document HTML is untrusted input — it arrives from the
 * JSON tab, from pasted Word/Google-Docs content, from imported .html/.md
 * files and from stories other people shared. It is later assigned to
 * `innerHTML` of a `contenteditable`, so anything not explicitly allowed
 * here is a potential stored-XSS. The policy is therefore a WHITE-list:
 * unknown tags are unwrapped, unknown attributes dropped, unknown CSS
 * properties dropped, unknown URL schemes dropped.
 */

export const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  "p", "div", "span", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "sub", "sup", "mark", "small", "kbd", "abbr",
  "a", "ul", "ol", "li", "blockquote", "pre", "code",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "caption",
  "img", "figure", "figcaption", "section",
]);

/** Removed together with everything inside them (not merely unwrapped). */
export const DROP_WITH_CONTENT: ReadonlySet<string> = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "noscript", "template",
  "link", "meta", "base", "form", "input", "button", "textarea", "select", "option", "svg", "math",
  "audio", "video", "canvas", "title", "head", "xml",
]);

/** Attributes allowed on every kept element. */
export const GLOBAL_ATTRS: ReadonlySet<string> = new Set(["style", "class", "title", "lang", "dir"]);

/** `data-*` attributes the editor itself relies on. Everything else is dropped. */
export const ALLOWED_DATA_ATTRS: ReadonlySet<string> = new Set([
  "data-lang",
  "data-indent",
  "data-checked",
  "data-align",
  "data-wrap",
  "data-img-id",
  "data-fn",
  "data-tex",
  "data-caption",
  "data-theme",
]);

export const TAG_ATTRS: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(["href", "target", "rel", "name"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  col: new Set(["span"]),
  ol: new Set(["start", "type", "reversed"]),
  li: new Set(["value"]),
};

/** Only classes the editor owns survive (prefix `sr-`). */
export const CLASS_PATTERN = /^sr-[a-z0-9_-]+$/;

export type UrlKind = "link" | "image";

const LINK_SCHEMES: ReadonlySet<string> = new Set(["http", "https", "mailto", "tel"]);
const IMAGE_SCHEMES: ReadonlySet<string> = new Set(["http", "https", "data", "sr-img"]);
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif)(;base64)?,/i;

/**
 * Decides whether a URL may appear in `href` / `src`.
 *
 * Browsers ignore ASCII control characters and whitespace *inside* a
 * scheme (`java\tscript:`), so those are stripped before the scheme is
 * read — otherwise the classic `jav&#x09;ascript:` bypass would work.
 */
export function isSafeUrl(raw: string, kind: UrlKind): boolean {
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000- \u007f-\u009f]+/g, "");
  if (!cleaned) return false;
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(cleaned);
  if (!m) return true; // relative URL, fragment, or query — no scheme to abuse
  const scheme = m[1].toLowerCase();
  if (kind === "link") return LINK_SCHEMES.has(scheme);
  if (!IMAGE_SCHEMES.has(scheme)) return false;
  if (scheme === "data") return SAFE_DATA_IMAGE.test(cleaned);
  return true;
}

// --- CSS ---------------------------------------------------------------------

const COLOR = /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[-\d.%\s,/]+\)|[a-zA-Z]{3,24}|transparent)$/;
const LENGTH = /^(-?\d+(\.\d+)?(px|pt|em|rem|%|vw|vh|ch|cm|mm|in|ex)?|auto|0|normal)$/;
const LENGTH_LIST = /^(-?\d+(\.\d+)?(px|pt|em|rem|%|vw|vh|ch|cm|mm|in|ex)?|auto)(\s+(-?\d+(\.\d+)?(px|pt|em|rem|%|vw|vh|ch|cm|mm|in|ex)?|auto)){0,3}$/;
const FONT_FAMILY = /^[\w\s,"'.\-]+$/;
const SAFE_FREE = /^[a-zA-Z0-9\s#(),.%\-+"']+$/;
const KEYWORD = (...words: string[]): RegExp => new RegExp(`^(${words.join("|")})$`, "i");

type Validator = (value: string) => boolean;
const re = (r: RegExp): Validator => (v) => r.test(v);

/** property -> validator. A property absent from this map is dropped. */
export const STYLE_VALIDATORS: Readonly<Record<string, Validator>> = {
  color: re(COLOR),
  "background-color": re(COLOR),
  "font-family": re(FONT_FAMILY),
  "font-size": re(
    /^(-?\d+(\.\d+)?(px|pt|em|rem|%|vw|vh|ch|cm|mm|in|ex)?|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/i
  ),
  "font-weight": re(/^(normal|bold|bolder|lighter|[1-9]00)$/i),
  "font-style": re(KEYWORD("normal", "italic", "oblique")),
  "text-decoration": re(/^[a-zA-Z\s#(),.\d%-]+$/),
  "text-decoration-line": re(/^(none|underline|overline|line-through)(\s+(underline|overline|line-through))*$/i),
  "text-align": re(KEYWORD("left", "right", "center", "justify", "start", "end")),
  "line-height": re(/^(normal|\d+(\.\d+)?(px|pt|em|rem|%)?)$/),
  "letter-spacing": re(LENGTH),
  "text-indent": re(LENGTH),
  "vertical-align": re(/^(baseline|sub|super|top|middle|bottom|text-top|text-bottom|-?\d+(\.\d+)?(px|pt|em|%)?)$/i),
  float: re(KEYWORD("left", "right", "none")),
  display: re(KEYWORD("block", "inline", "inline-block")),
  margin: re(LENGTH_LIST),
  "margin-top": re(LENGTH),
  "margin-right": re(LENGTH),
  "margin-bottom": re(LENGTH),
  "margin-left": re(LENGTH),
  padding: re(LENGTH_LIST),
  "padding-top": re(LENGTH),
  "padding-right": re(LENGTH),
  "padding-bottom": re(LENGTH),
  "padding-left": re(LENGTH),
  width: re(LENGTH),
  height: re(LENGTH),
  "max-width": re(LENGTH),
  "min-width": re(LENGTH),
  "min-height": re(LENGTH),
  border: re(SAFE_FREE),
  "border-top": re(SAFE_FREE),
  "border-right": re(SAFE_FREE),
  "border-bottom": re(SAFE_FREE),
  "border-left": re(SAFE_FREE),
  "border-color": re(SAFE_FREE),
  "border-width": re(SAFE_FREE),
  "border-style": re(SAFE_FREE),
  "border-collapse": re(KEYWORD("collapse", "separate")),
  "border-radius": re(LENGTH_LIST),
  "white-space": re(KEYWORD("normal", "pre", "pre-wrap", "nowrap", "pre-line")),
  "list-style-type": re(/^[a-z-]{2,30}$/i),
  "break-after": re(KEYWORD("page", "always", "avoid", "auto")),
  "page-break-after": re(KEYWORD("page", "always", "avoid", "auto")),
  "page-break-before": re(KEYWORD("page", "always", "avoid", "auto")),
};

/** Declarations that could smuggle a request or script, regardless of property. */
const DANGEROUS_VALUE = /(url\s*\(|expression\s*\(|javascript:|vbscript:|@import|behaviou?r\s*:|-moz-binding|\\|<|>)/i;

/** Filters a `style` attribute down to validated declarations. */
export class StylePolicy {
  filter(style: string): string {
    const out: string[] = [];
    for (const decl of style.split(";")) {
      const idx = decl.indexOf(":");
      if (idx <= 0) continue;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim().replace(/\s*!important\s*$/i, "");
      if (!value || value.length > 200) continue;
      if (DANGEROUS_VALUE.test(value)) continue;
      const validator = STYLE_VALIDATORS[prop];
      if (!validator || !validator(value)) continue;
      out.push(`${prop}: ${value}`);
    }
    return out.join("; ");
  }
}

export const MAX_NESTING_DEPTH = 64;
