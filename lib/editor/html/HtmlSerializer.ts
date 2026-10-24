import { escapeAttr, escapeText } from "@/lib/editor/html/entities";
import { FRAGMENT_TAG, HtmlNode, VOID_TAGS, isText } from "@/lib/editor/html/HtmlNode";

/** Turns an `HtmlNode` tree back into a string. Inverse of `HtmlParser`
 *  for every tree the parser can produce. */
export class HtmlSerializer {
  serialize(nodeOrNodes: HtmlNode | readonly HtmlNode[]): string {
    const nodes = Array.isArray(nodeOrNodes) ? (nodeOrNodes as readonly HtmlNode[]) : [nodeOrNodes as HtmlNode];
    return nodes.map((n) => this.one(n)).join("");
  }

  /** Children only — what `innerHTML` would give for the node. */
  inner(node: HtmlNode): string {
    return isText(node) ? escapeText(node.value) : node.children.map((c) => this.one(c)).join("");
  }

  private one(node: HtmlNode): string {
    if (isText(node)) return escapeText(node.value);
    if (node.tag === FRAGMENT_TAG) return node.children.map((c) => this.one(c)).join("");
    const attrs = Object.entries(node.attrs)
      .map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`))
      .join("");
    if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs}>`;
    return `<${node.tag}${attrs}>${node.children.map((c) => this.one(c)).join("")}</${node.tag}>`;
  }
}
