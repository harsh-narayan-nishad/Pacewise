import { HtmlParser } from "@/lib/editor/html/HtmlParser";
import { HtmlSanitizer } from "@/lib/editor/html/HtmlSanitizer";
import { Block, BlockVisitor, CodeBlock, runsToPlain } from "@/lib/editor/model/Blocks";
import { BlockExtractor } from "@/lib/editor/model/BlockExtractor";

export type PaperSize = "A4" | "Letter" | "Legal";
export type Orientation = "portrait" | "landscape";

export interface PageSettings {
  readonly paper: PaperSize;
  readonly orientation: Orientation;
  /** Margins in millimetres. */
  readonly margins: { top: number; right: number; bottom: number; left: number };
  readonly header: string;
  readonly footer: string;
  readonly pageNumbers: boolean;
  /** Page background colour (hex / rgb), optional. */
  readonly background?: string;
}

export interface DocumentMeta {
  readonly title: string;
  readonly author: string;
  readonly description: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Serializable shape stored in `StoryData.richDocument` and in the DocumentStore. */
export interface RichDocumentSnapshot {
  readonly v: 1;
  readonly html: string;
  readonly meta: DocumentMeta;
  readonly page: PageSettings;
}

export interface DocumentStats {
  readonly words: number;
  readonly characters: number;
  readonly charactersNoSpaces: number;
  readonly paragraphs: number;
  readonly codeBlocks: number;
  readonly readingMinutes: number;
}

export const DEFAULT_PAGE: PageSettings = {
  paper: "A4",
  orientation: "portrait",
  margins: { top: 25, right: 25, bottom: 25, left: 25 },
  header: "",
  footer: "",
  pageNumbers: true,
};

export function defaultMeta(title = "Untitled document", now = Date.now()): DocumentMeta {
  return { title, author: "", description: "", createdAt: now, updatedAt: now };
}

const PAPER_MM: Record<PaperSize, [number, number]> = { A4: [210, 297], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };

export function pageDimensionsMm(p: PageSettings): { width: number; height: number } {
  const [w, h] = PAPER_MM[p.paper] ?? PAPER_MM.A4;
  return p.orientation === "landscape" ? { width: h, height: w } : { width: w, height: h };
}

const sharedParser = new HtmlParser();
const sharedSanitizer = new HtmlSanitizer();
const sharedExtractor = new BlockExtractor();

function clampMargin(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(60, Math.max(5, n)) : fallback;
}

/**
 * An immutable document: sanitized HTML + metadata + page setup.
 *
 * Every "mutation" returns a new instance (`withHtml`, `withMeta`, ...), so
 * undo history, autosave diffing and React state never alias a mutated
 * object. The block model is derived lazily and cached.
 */
export class RichDocument {
  private cachedBlocks?: readonly Block[];
  private cachedStats?: DocumentStats;

  private constructor(
    readonly html: string,
    readonly meta: DocumentMeta,
    readonly page: PageSettings
  ) {}

  /** Entry point for UNTRUSTED html: always sanitizes. */
  static fromHtml(html: string, meta: DocumentMeta = defaultMeta(), page: PageSettings = DEFAULT_PAGE): RichDocument {
    return new RichDocument(sharedSanitizer.sanitize(html), meta, page);
  }

  static empty(title?: string): RichDocument {
    return new RichDocument("<p></p>", defaultMeta(title), DEFAULT_PAGE);
  }

  /** Validates an unknown value (e.g. parsed JSON) and returns a document or null. */
  static fromSnapshot(raw: unknown): RichDocument | null {
    if (!raw || typeof raw !== "object") return null;
    const s = raw as Partial<RichDocumentSnapshot>;
    if (s.v !== 1 || typeof s.html !== "string") return null;
    const m = (s.meta ?? {}) as Partial<DocumentMeta>;
    const now = Date.now();
    const meta: DocumentMeta = {
      title: typeof m.title === "string" ? m.title.slice(0, 300) : "Untitled document",
      author: typeof m.author === "string" ? m.author.slice(0, 200) : "",
      description: typeof m.description === "string" ? m.description.slice(0, 2000) : "",
      createdAt: typeof m.createdAt === "number" ? m.createdAt : now,
      updatedAt: typeof m.updatedAt === "number" ? m.updatedAt : now,
    };
    const p = (s.page ?? {}) as Partial<PageSettings>;
    const mg = (p.margins ?? {}) as Partial<PageSettings["margins"]>;
    const page: PageSettings = {
      paper: p.paper === "Letter" || p.paper === "Legal" ? p.paper : "A4",
      orientation: p.orientation === "landscape" ? "landscape" : "portrait",
      margins: {
        top: clampMargin(mg.top, 25),
        right: clampMargin(mg.right, 25),
        bottom: clampMargin(mg.bottom, 25),
        left: clampMargin(mg.left, 25),
      },
      header: typeof p.header === "string" ? p.header.slice(0, 500) : "",
      footer: typeof p.footer === "string" ? p.footer.slice(0, 500) : "",
      pageNumbers: p.pageNumbers !== false,
      background: typeof p.background === "string" && /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s,.%]+\))$/.test(p.background) ? p.background : undefined,
    };
    return RichDocument.fromHtml(s.html, meta, page);
  }

  withHtml(html: string): RichDocument {
    const clean = sharedSanitizer.sanitize(html);
    if (clean === this.html) return this;
    return new RichDocument(clean, { ...this.meta, updatedAt: Date.now() }, this.page);
  }
  withMeta(patch: Partial<DocumentMeta>): RichDocument {
    return new RichDocument(this.html, { ...this.meta, ...patch, updatedAt: Date.now() }, this.page);
  }
  withPage(patch: Partial<PageSettings>): RichDocument {
    return new RichDocument(this.html, this.meta, { ...this.page, ...patch });
  }

  snapshot(): RichDocumentSnapshot {
    return { v: 1, html: this.html, meta: this.meta, page: this.page };
  }

  get blocks(): readonly Block[] {
    if (!this.cachedBlocks) this.cachedBlocks = sharedExtractor.extract(sharedParser.parse(this.html));
    return this.cachedBlocks;
  }

  accept<R>(visitor: BlockVisitor<R>): R[] {
    return this.blocks.map((b) => b.accept(visitor));
  }

  get stats(): DocumentStats {
    if (this.cachedStats) return this.cachedStats;
    const counter = new StatsVisitor();
    this.accept(counter);
    this.cachedStats = counter.result();
    return this.cachedStats;
  }

  /**
   * Plain paragraphs for the reading engine. Code blocks are included as a
   * single paragraph of their text so nothing the author wrote vanishes.
   */
  toReadingParagraphs(): string[] {
    const out: string[] = [];
    for (const b of this.blocks) {
      const text = b.accept(new PlainParagraphVisitor()).filter((t) => t.trim() !== "");
      out.push(...text);
    }
    return out;
  }
}

/** Words-per-minute used for the "reading time" label (silent reading average). */
export const READING_WPM = 230;

class StatsVisitor implements BlockVisitor<void> {
  private words = 0;
  private chars = 0;
  private charsNoSpace = 0;
  private paragraphs = 0;
  private codeBlocks = 0;

  private add(text: string, countAsParagraph: boolean): void {
    const t = text.trim();
    if (!t) return;
    if (countAsParagraph) this.paragraphs += 1;
    this.words += t.split(/\s+/).length;
    this.chars += text.length;
    this.charsNoSpace += text.replace(/\s/g, "").length;
  }
  paragraph(b: import("@/lib/editor/model/Blocks").ParagraphBlock): void {
    this.add(runsToPlain(b.runs), true);
  }
  heading(b: import("@/lib/editor/model/Blocks").HeadingBlock): void {
    this.add(runsToPlain(b.runs), true);
  }
  list(b: import("@/lib/editor/model/Blocks").ListBlock): void {
    b.items.forEach((i) => this.add(runsToPlain(i.runs), true));
  }
  code(b: CodeBlock): void {
    // Code counts toward characters and blocks but not toward prose words.
    this.codeBlocks += 1;
    this.chars += b.code.length;
    this.charsNoSpace += b.code.replace(/\s/g, "").length;
  }
  image(): void {}
  table(b: import("@/lib/editor/model/Blocks").TableBlock): void {
    b.rows.forEach((r) => r.forEach((c) => c.blocks.forEach((x) => x.accept(this))));
  }
  rule(): void {}
  pageBreak(): void {}
  footnotes(b: import("@/lib/editor/model/Blocks").FootnotesBlock): void {
    b.notes.forEach((n) => this.add(runsToPlain(n.runs), false));
  }
  result(): DocumentStats {
    return {
      words: this.words,
      characters: this.chars,
      charactersNoSpaces: this.charsNoSpace,
      paragraphs: this.paragraphs,
      codeBlocks: this.codeBlocks,
      readingMinutes: this.words === 0 ? 0 : Math.max(1, Math.ceil(this.words / READING_WPM)),
    };
  }
}

class PlainParagraphVisitor implements BlockVisitor<string[]> {
  paragraph(b: import("@/lib/editor/model/Blocks").ParagraphBlock): string[] {
    return [runsToPlain(b.runs).replace(/\n/g, " ").trim()];
  }
  heading(b: import("@/lib/editor/model/Blocks").HeadingBlock): string[] {
    return [runsToPlain(b.runs).trim()];
  }
  list(b: import("@/lib/editor/model/Blocks").ListBlock): string[] {
    return b.items.map((i) => runsToPlain(i.runs).trim());
  }
  code(b: CodeBlock): string[] {
    return [b.code.trim()];
  }
  image(b: import("@/lib/editor/model/Blocks").ImageBlock): string[] {
    return b.caption ? [b.caption] : [];
  }
  table(b: import("@/lib/editor/model/Blocks").TableBlock): string[] {
    return b.rows.map((r) =>
      r.map((c) => c.blocks.flatMap((x) => x.accept(this)).join(" ")).filter(Boolean).join(" | ")
    );
  }
  rule(): string[] {
    return [];
  }
  pageBreak(): string[] {
    return [];
  }
  footnotes(b: import("@/lib/editor/model/Blocks").FootnotesBlock): string[] {
    return b.notes.map((n) => runsToPlain(n.runs).trim());
  }
}
