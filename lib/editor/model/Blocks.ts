/**
 * The editor's structured document model.
 *
 * The *editing surface* works with HTML (that is what `contenteditable`
 * natively manipulates). Everything that has to REASON about a document —
 * counting words, producing Markdown, writing a .docx, feeding the
 * reading engine — works with this model instead, because walking typed
 * objects is far less error-prone than re-interpreting markup in five
 * places.
 *
 * OOP shape:
 *   - `Block` is an abstract base class; each kind of content is a concrete
 *     subclass (inheritance, polymorphism).
 *   - Blocks are IMMUTABLE value objects (`readonly` fields).
 *   - Behaviour that depends on the output format lives in `BlockVisitor`
 *     implementations, not in the blocks (Visitor pattern / double
 *     dispatch). Adding a new export format = one new visitor class, and no
 *     existing block class changes (Open/Closed).
 */

export type Align = "left" | "center" | "right" | "justify";

export interface RunMarks {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strike?: boolean;
  readonly sub?: boolean;
  readonly sup?: boolean;
  readonly code?: boolean;
  readonly color?: string;
  readonly background?: string;
  readonly fontFamily?: string;
  /** CSS font-size as written (e.g. "18px"). */
  readonly fontSize?: string;
  readonly link?: string;
  /** Footnote id this run is the reference mark for. */
  readonly footnote?: string;
  /** Source LaTeX-lite of an inline equation (the run text is its rendering). */
  readonly math?: string;
}

/** A stretch of text sharing one set of marks. `"\n"` is a soft line break. */
export class InlineRun {
  constructor(readonly text: string, readonly marks: RunMarks = {}) {}

  get isBreak(): boolean {
    return this.text === "\n";
  }

  hasSameMarks(other: InlineRun): boolean {
    const a = this.marks as Record<string, unknown>;
    const b = other.marks as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of Array.from(keys)) {
      if ((a[k] ?? false) !== (b[k] ?? false)) return false;
    }
    return true;
  }

  withText(text: string): InlineRun {
    return new InlineRun(text, this.marks);
  }
}

export function runsToPlain(runs: readonly InlineRun[]): string {
  return runs.map((r) => r.text).join("");
}

/** Merges neighbouring runs that carry identical marks. */
export function mergeRuns(runs: readonly InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (last && !last.isBreak && !run.isBreak && last.hasSameMarks(run)) {
      out[out.length - 1] = last.withText(last.text + run.text);
    } else {
      out.push(run);
    }
  }
  return out;
}

export type BlockKind = "paragraph" | "heading" | "list" | "code" | "image" | "table" | "rule" | "pagebreak" | "footnotes";

export interface BlockVisitor<R> {
  paragraph(block: ParagraphBlock): R;
  heading(block: HeadingBlock): R;
  list(block: ListBlock): R;
  code(block: CodeBlock): R;
  image(block: ImageBlock): R;
  table(block: TableBlock): R;
  rule(block: RuleBlock): R;
  pageBreak(block: PageBreakBlock): R;
  footnotes(block: FootnotesBlock): R;
}

export abstract class Block {
  abstract readonly kind: BlockKind;
  abstract accept<R>(visitor: BlockVisitor<R>): R;
  /** True when the block carries no visible content (used to skip blanks). */
  abstract isEmpty(): boolean;
}

export type ParagraphStyle = "normal" | "title" | "subtitle" | "quote";

export class ParagraphBlock extends Block {
  readonly kind = "paragraph" as const;
  constructor(
    readonly runs: readonly InlineRun[],
    readonly align?: Align,
    readonly style: ParagraphStyle = "normal",
    readonly lineHeight?: string,
    readonly indentPx?: number
  ) {
    super();
  }
  accept<R>(v: BlockVisitor<R>): R {
    return v.paragraph(this);
  }
  isEmpty(): boolean {
    return runsToPlain(this.runs).trim() === "";
  }
}

export class HeadingBlock extends Block {
  readonly kind = "heading" as const;
  constructor(readonly level: 1 | 2 | 3 | 4 | 5 | 6, readonly runs: readonly InlineRun[], readonly align?: Align) {
    super();
  }
  accept<R>(v: BlockVisitor<R>): R {
    return v.heading(this);
  }
  isEmpty(): boolean {
    return runsToPlain(this.runs).trim() === "";
  }
}

export interface ListItem {
  readonly runs: readonly InlineRun[];
  /** 0 = top level. */
  readonly depth: number;
  readonly ordered: boolean;
  /** Defined only for checklist items. */
  readonly checked?: boolean;
}

export class ListBlock extends Block {
  readonly kind = "list" as const;
  constructor(readonly items: readonly ListItem[]) {
    super();
  }
  accept<R>(v: BlockVisitor<R>): R {
    return v.list(this);
  }
  isEmpty(): boolean {
    return this.items.every((i) => runsToPlain(i.runs).trim() === "");
  }
}

export class CodeBlock extends Block {
  readonly kind = "code" as const;
  constructor(readonly code: string, readonly language: string = "plaintext") {
    super();
  }
  accept<R>(v: BlockVisitor<R>): R {
    return v.code(this);
  }
  isEmpty(): boolean {
    return this.code.trim() === "";
  }
}

export class ImageBlock extends Block {
  readonly kind = "image" as const;
  constructor(
    readonly src: string,
    readonly alt: string = "",
    readonly caption: string = "",
    readonly width?: number,
    readonly height?: number,
    readonly align?: Align,
    /** Content-address (SHA-256 hex) of the image bytes, when known. */
    readonly imageId?: string
  ) {
    super();
  }
  accept<R>(v: BlockVisitor<R>): R {
    return v.image(this);
  }
  isEmpty(): boolean {
    return !this.src;
  }
}

export interface TableCell {
  readonly blocks: readonly Block[];
  readonly header: boolean;
  readonly colspan: number;
  readonly rowspan: number;
  readonly background?: string;
}

export class TableBlock extends Block {
  readonly kind = "table" as const;
  constructor(readonly rows: readonly (readonly TableCell[])[]) {
    super();
  }
  accept<R>(v: BlockVisitor<R>): R {
    return v.table(this);
  }
  isEmpty(): boolean {
    return this.rows.length === 0;
  }
}

export class RuleBlock extends Block {
  readonly kind = "rule" as const;
  accept<R>(v: BlockVisitor<R>): R {
    return v.rule(this);
  }
  isEmpty(): boolean {
    return false;
  }
}

export class PageBreakBlock extends Block {
  readonly kind = "pagebreak" as const;
  accept<R>(v: BlockVisitor<R>): R {
    return v.pageBreak(this);
  }
  isEmpty(): boolean {
    return false;
  }
}

export interface Footnote {
  readonly id: string;
  readonly runs: readonly InlineRun[];
}

export class FootnotesBlock extends Block {
  readonly kind = "footnotes" as const;
  constructor(readonly notes: readonly Footnote[]) {
    super();
  }
  accept<R>(v: BlockVisitor<R>): R {
    return v.footnotes(this);
  }
  isEmpty(): boolean {
    return this.notes.length === 0;
  }
}

/**
 * Per-depth counters for numbered lists. Shared by every visitor that has
 * to print "1. 2. 3." (plain text, Markdown, .docx fallbacks) so the
 * numbering rule — restart a level whenever you come back up from a
 * deeper one — exists exactly once.
 */
export class ListNumbering {
  private counters: number[] = [];

  next(depth: number): number {
    this.counters.length = depth + 1;
    for (let i = 0; i <= depth; i += 1) if (this.counters[i] === undefined) this.counters[i] = 0;
    this.counters[depth] += 1;
    return this.counters[depth];
  }

  /** Call for an item that is NOT numbered, so a later numbered item at
   *  the same depth starts again from 1. */
  reset(depth: number): void {
    this.counters.length = depth;
  }
}
