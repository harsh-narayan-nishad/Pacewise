/** Remembers the caret/selection inside `root` so toolbar popovers, inputs
 *  and fullscreen switches can steal focus and then give it back. */
export class SelectionMemento {
  private range: Range | null = null;
  constructor(private readonly root: HTMLElement) {}

  save(): void {
    const s = window.getSelection();
    if (s && s.rangeCount && this.root.contains(s.anchorNode)) this.range = s.getRangeAt(0).cloneRange();
  }
  restore(): boolean {
    if (!this.range || !this.root.contains(this.range.commonAncestorContainer)) return false;
    const s = window.getSelection();
    if (!s) return false;
    this.root.focus({ preventScroll: true });
    s.removeAllRanges();
    s.addRange(this.range);
    return true;
  }
  get saved(): Range | null { return this.range; }
}

/** Selection as text offsets — survives the DOM being rebuilt from HTML (undo/redo). */
export function textNodes(root: HTMLElement): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => ((n.parentElement?.closest(".sr-code-widget")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n as Text);
  return out;
}

export function selectionOffsets(root: HTMLElement): { start: number; end: number } {
  const s = window.getSelection();
  if (!s || !s.rangeCount || !root.contains(s.anchorNode)) return { start: 0, end: 0 };
  const r = s.getRangeAt(0);
  const off = (node: Node, o: number): number => {
    let total = 0;
    for (const t of textNodes(root)) {
      if (t === node) return total + o;
      total += t.data.length;
    }
    // element container: count text before the boundary
    const pre = document.createRange();
    pre.setStart(root, 0);
    pre.setEnd(node, o);
    let n = 0;
    for (const t of textNodes(root)) if (pre.comparePoint(t, 0) <= 0 && pre.comparePoint(t, t.data.length) <= 0) n += t.data.length;
    return n;
  };
  return { start: off(r.startContainer, r.startOffset), end: off(r.endContainer, r.endOffset) };
}

export function restoreOffsets(root: HTMLElement, start: number, end: number): void {
  const find = (target: number): { node: Text; offset: number } | null => {
    let total = 0;
    const nodes = textNodes(root);
    for (const t of nodes) {
      if (target <= total + t.data.length) return { node: t, offset: target - total };
      total += t.data.length;
    }
    const last = nodes[nodes.length - 1];
    return last ? { node: last, offset: last.data.length } : null;
  };
  const a = find(start);
  const b = find(end);
  const s = window.getSelection();
  if (!a || !b || !s) return;
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  s.removeAllRanges();
  s.addRange(r);
}
