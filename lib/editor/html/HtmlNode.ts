/**
 * Minimal, framework-free HTML tree used by the whole editor core.
 *
 * WHY our own tree instead of the browser's DOM: the document model, the
 * sanitizer, every exporter and every importer must behave identically in
 * the browser, on the server and under `tsx` in tests. `DOMParser` exists
 * in only one of those. A ~150-line parser for the subset of HTML the
 * editor itself produces (plus whatever a user pastes, which is sanitized
 * down to that subset) buys deterministic, unit-testable behaviour.
 */

export interface HtmlText {
  readonly type: "text";
  value: string;
}

export interface HtmlElement {
  readonly type: "element";
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
}

export type HtmlNode = HtmlText | HtmlElement;

export const FRAGMENT_TAG = "#fragment";

export const VOID_TAGS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

export function textNode(value: string): HtmlText {
  return { type: "text", value };
}

export function elementNode(
  tag: string,
  attrs: Record<string, string> = {},
  children: HtmlNode[] = []
): HtmlElement {
  return { type: "element", tag, attrs, children };
}

export function isElement(node: HtmlNode): node is HtmlElement {
  return node.type === "element";
}

export function isText(node: HtmlNode): node is HtmlText {
  return node.type === "text";
}

/** Concatenated text of a subtree, `<br>` counting as a newline. */
export function textContent(node: HtmlNode): string {
  if (isText(node)) return node.value;
  if (node.tag === "br") return "\n";
  return node.children.map(textContent).join("");
}

/** Depth-first visit. Return `false` from the callback to skip a subtree. */
export function walk(node: HtmlNode, visit: (n: HtmlNode) => boolean | void): void {
  if (visit(node) === false) return;
  if (isElement(node)) node.children.forEach((c) => walk(c, visit));
}

export function findAll(root: HtmlNode, predicate: (el: HtmlElement) => boolean): HtmlElement[] {
  const out: HtmlElement[] = [];
  walk(root, (n) => {
    if (isElement(n) && predicate(n)) out.push(n);
  });
  return out;
}

export function classList(el: HtmlElement): string[] {
  return (el.attrs.class ?? "").split(/\s+/).filter(Boolean);
}

export function hasClass(el: HtmlElement, name: string): boolean {
  return classList(el).includes(name);
}

/** Parses an inline `style="a: b; c: d"` string into a lowercase map. */
export function parseStyle(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx <= 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (prop && value) out[prop] = value;
  }
  return out;
}

export function styleToString(style: Record<string, string>): string {
  return Object.entries(style)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}
