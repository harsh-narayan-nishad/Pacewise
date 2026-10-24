import {
  Align, Block, BlockVisitor, CodeBlock, FootnotesBlock, HeadingBlock, ImageBlock, InlineRun, ListBlock,
  PageBreakBlock, ParagraphBlock, RuleBlock, RunMarks, TableBlock, TableCell,
} from "@/lib/editor/model/Blocks";
import { RichDocument, pageDimensionsMm } from "@/lib/editor/model/RichDocument";
import { DocumentExporter, ExportResult, ImageResolver, safeFilename } from "@/lib/editor/export/Exporter";
import { ZipWriter } from "@/lib/editor/export/ZipWriter";

const xmlEsc = (s: string) =>
  // eslint-disable-next-line no-control-regex
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mmToTwip = (mm: number) => Math.round((mm / 25.4) * 1440);
const pxToEmu = (px: number) => Math.round(px * 9525);

function hex(color?: string): string | undefined {
  if (!color) return undefined;
  const m3 = /^#([0-9a-f]{3})$/i.exec(color);
  if (m3) return m3[1].split("").map((c) => c + c).join("").toUpperCase();
  const m6 = /^#([0-9a-f]{6})/i.exec(color);
  if (m6) return m6[1].toUpperCase();
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("").toUpperCase();
  return undefined;
}

function halfPoints(size?: string): number | undefined {
  if (!size) return undefined;
  const m = /^(\d+(?:\.\d+)?)(px|pt)$/.exec(size);
  if (!m) return undefined;
  const pt = m[2] === "px" ? Number(m[1]) * 0.75 : Number(m[1]);
  return Math.max(2, Math.round(pt * 2));
}

const JC: Record<Align, string> = { left: "left", center: "center", right: "right", justify: "both" };

interface Rel { id: string; type: string; target: string; external?: boolean }

/** Builds WordprocessingML for each block (Visitor) while collecting
 *  relationships (hyperlinks, images) the package needs. */
class DocxVisitor implements BlockVisitor<string> {
  readonly rels: Rel[] = [];
  readonly media: { name: string; bytes: Uint8Array; ext: string }[] = [];
  private nextRel = 10;
  private imageCount = 0;

  constructor(private readonly resolve: ImageResolver | undefined) {}

  private rel(type: string, target: string, external = false): string {
    const id = `rId${this.nextRel++}`;
    this.rels.push({ id, type, target, external });
    return id;
  }

  private rPr(m: RunMarks, extra = ""): string {
    const p: string[] = [];
    if (m.code) p.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>');
    else if (m.fontFamily) {
      const f = xmlEsc(m.fontFamily.split(",")[0].replace(/["']/g, "").trim());
      p.push(`<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>`);
    }
    if (m.bold) p.push("<w:b/>");
    if (m.italic) p.push("<w:i/>");
    if (m.strike) p.push("<w:strike/>");
    const c = hex(m.color) ?? (m.link ? "0563C1" : undefined);
    if (c) p.push(`<w:color w:val="${c}"/>`);
    const sz = halfPoints(m.fontSize);
    if (sz) p.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);
    const bg = hex(m.background);
    if (bg) p.push(`<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`);
    else if (m.code) p.push('<w:shd w:val="clear" w:color="auto" w:fill="F1F1F1"/>');
    if (m.underline || m.link) p.push('<w:u w:val="single"/>');
    if (m.sub) p.push('<w:vertAlign w:val="subscript"/>');
    else if (m.sup) p.push('<w:vertAlign w:val="superscript"/>');
    return p.length || extra ? `<w:rPr>${p.join("")}${extra}</w:rPr>` : "";
  }

  runs(runs: readonly InlineRun[], extraRPr = ""): string {
    return runs
      .map((r) => {
        if (r.isBreak) return "<w:r><w:br/></w:r>";
        const body = `<w:r>${this.rPr(r.marks, extraRPr)}<w:t xml:space="preserve">${xmlEsc(r.text)}</w:t></w:r>`;
        if (r.marks.link) {
          const id = this.rel("http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", r.marks.link, true);
          return `<w:hyperlink r:id="${id}">${body}</w:hyperlink>`;
        }
        return body;
      })
      .join("");
  }

  private pPr(style: string | undefined, align?: Align, extra = ""): string {
    const s = style ? `<w:pStyle w:val="${style}"/>` : "";
    const j = align ? `<w:jc w:val="${JC[align]}"/>` : "";
    return s || j || extra ? `<w:pPr>${s}${extra}${j}</w:pPr>` : "";
  }

  paragraph(b: ParagraphBlock): string {
    const style = b.style === "title" ? "Title" : b.style === "subtitle" ? "Subtitle" : b.style === "quote" ? "Quote" : undefined;
    const ind = b.indentPx ? `<w:ind w:left="${Math.round(b.indentPx * 15)}"/>` : "";
    return `<w:p>${this.pPr(style, b.align, ind)}${this.runs(b.runs)}</w:p>`;
  }
  heading(b: HeadingBlock): string {
    return `<w:p>${this.pPr(`Heading${b.level}`, b.align)}${this.runs(b.runs)}</w:p>`;
  }
  list(b: ListBlock): string {
    return b.items
      .map((i) => {
        const numId = i.checked !== undefined ? 3 : i.ordered ? 2 : 1;
        const lvl = Math.min(8, i.depth);
        const box = i.checked === undefined ? "" : i.checked ? "☑ " : "☐ ";
        const prefix = box ? `<w:r><w:t xml:space="preserve">${box}</w:t></w:r>` : "";
        return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${prefix}${this.runs(i.runs)}</w:p>`;
      })
      .join("");
  }
  code(b: CodeBlock): string {
    const lines = b.code.split("\n");
    return lines
      .map(
        (l, idx) =>
          `<w:p><w:pPr><w:pStyle w:val="Code"/>${idx === 0 && b.language !== "plaintext" ? "" : ""}</w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(l)}</w:t></w:r></w:p>`
      )
      .join("");
  }
  image(b: ImageBlock): string {
    const res = this.resolve?.(b.src);
    const caption = b.caption ? `<w:p>${this.pPr("Caption", "center")}${this.runs([new InlineRun(b.caption)])}</w:p>` : "";
    if (!res) {
      const t = b.alt || b.caption || "image";
      return `<w:p><w:r><w:t xml:space="preserve">[${xmlEsc(t)}]</w:t></w:r></w:p>${caption}`;
    }
    const ext = res.mime.includes("png") ? "png" : res.mime.includes("gif") ? "gif" : res.mime.includes("webp") ? "webp" : "jpeg";
    this.imageCount += 1;
    const name = `image${this.imageCount}.${ext}`;
    this.media.push({ name, bytes: res.bytes, ext });
    const rid = this.rel("http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", `media/${name}`);
    const w = pxToEmu(b.width ?? 400);
    const h = pxToEmu(b.height ?? (b.width ? Math.round(b.width * 0.66) : 264));
    const n = this.imageCount;
    const drawing =
      `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${w}" cy="${h}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${xmlEsc(b.alt)}"/>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
      `</a:graphicData></a:graphic></wp:inline></w:drawing>`;
    return `<w:p>${this.pPr(undefined, b.align ?? "left")}<w:r>${drawing}</w:r></w:p>${caption}`;
  }
  table(b: TableBlock): string {
    if (!b.rows.length) return "";
    const border = ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`)
      .join("");
    const cols = Math.max(...b.rows.map((r) => r.reduce((a, c) => a + c.colspan, 0)));
    const grid = Array(cols).fill('<w:gridCol w:w="2000"/>').join("");
    // Track cells carried down by rowspans so vMerge continuation cells are emitted.
    const carry: number[] = Array(cols).fill(0);
    const rows = b.rows.map((row) => {
      let col = 0;
      const cells: string[] = [];
      const emitContinuations = () => {
        while (col < cols && carry[col] > 0) {
          cells.push('<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:vMerge/></w:tcPr><w:p/></w:tc>');
          carry[col] -= 1;
          col += 1;
        }
      };
      for (const cell of row) {
        emitContinuations();
        cells.push(this.cell(cell));
        for (let k = 0; k < cell.colspan; k += 1) if (cell.rowspan > 1) carry[col + k] = cell.rowspan - 1;
        col += cell.colspan;
      }
      emitContinuations();
      return `<w:tr>${cells.join("")}</w:tr>`;
    });
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${border}</w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows.join("")}</w:tbl><w:p/>`;
  }
  private cell(c: TableCell): string {
    const bg = hex(c.background);
    const props =
      `<w:tcW w:w="${2000 * c.colspan}" w:type="dxa"/>` +
      (c.colspan > 1 ? `<w:gridSpan w:val="${c.colspan}"/>` : "") +
      (c.rowspan > 1 ? '<w:vMerge w:val="restart"/>' : "") +
      (bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : c.header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : "");
    const body = c.blocks.map((x: Block) => x.accept(this)).join("") || "<w:p/>";
    const bold = c.header ? body.replace(/<w:r>(?!<w:rPr>)/g, "<w:r><w:rPr><w:b/></w:rPr>") : body;
    return `<w:tc><w:tcPr>${props}</w:tcPr>${bold}</w:tc>`;
  }
  rule(): string {
    return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>';
  }
  pageBreak(): string {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
  footnotes(b: FootnotesBlock): string {
    return b.notes
      .map((n, i) => `<w:p>${this.pPr("Footnote")}${this.runs([new InlineRun(`${i + 1}. `), ...n.runs])}</w:p>`)
      .join("");
  }
}

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

function numbering(): string {
  const bulletChars = ["•", "o", "▪"];
  const level = (i: number, fmt: string, text: string) =>
    `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  const bullets = Array.from({ length: 9 }, (_, i) => level(i, "bullet", bulletChars[i % 3])).join("");
  const numbers = Array.from({ length: 9 }, (_, i) => level(i, i % 3 === 0 ? "decimal" : i % 3 === 1 ? "lowerLetter" : "lowerRoman", `%${i + 1}.`)).join("");
  const checks = Array.from({ length: 9 }, (_, i) => level(i, "none", "")).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bullets}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>${numbers}</w:abstractNum><w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/>${checks}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="3"><w:abstractNumId w:val="2"/></w:num></w:numbering>`;
}

function styles(): string {
  const heading = (n: number, size: number) =>
    `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    [32, 28, 26, 24, 22, 22].map((s, i) => heading(i + 1, s)).join("") +
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="52"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="666666"/><w:sz w:val="30"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/></w:pPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F4F4F5"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:sz w:val="18"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Footnote"><w:name w:val="Footnote"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="18"/></w:rPr></w:style>` +
    `</w:styles>`;
}

export class DocxExporter implements DocumentExporter {
  readonly id = "docx";
  readonly label = "Word document (.docx)";
  readonly extension = "docx";

  export(doc: RichDocument, resolveImage?: ImageResolver): ExportResult {
    const v = new DocxVisitor(resolveImage);
    const body = doc.accept(v).join("");
    const { width, height } = pageDimensionsMm(doc.page);
    const m = doc.page.margins;
    const hasHeader = doc.page.header.trim() !== "";
    const hasFooter = doc.page.footer.trim() !== "" || doc.page.pageNumbers;

    const sect =
      `<w:sectPr>${hasHeader ? '<w:headerReference w:type="default" r:id="rId6"/>' : ""}${hasFooter ? '<w:footerReference w:type="default" r:id="rId7"/>' : ""}` +
      `<w:pgSz w:w="${mmToTwip(width)}" w:h="${mmToTwip(height)}"${doc.page.orientation === "landscape" ? ' w:orient="landscape"' : ""}/>` +
      `<w:pgMar w:top="${mmToTwip(m.top)}" w:right="${mmToTwip(m.right)}" w:bottom="${mmToTwip(m.bottom)}" w:left="${mmToTwip(m.left)}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body || "<w:p/>"}${sect}</w:body></w:document>`;

    const ext = new Set(v.media.map((x) => x.ext));
    const ct =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      Array.from(ext).map((e) => `<Default Extension="${e}" ContentType="image/${e}"/>`).join("") +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
      `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      (hasHeader ? `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` : "") +
      (hasFooter ? `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` : "") +
      `</Types>`;

    const rt = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const docRels =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${rt}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${rt}/numbering" Target="numbering.xml"/>` +
      (hasHeader ? `<Relationship Id="rId6" Type="${rt}/header" Target="header1.xml"/>` : "") +
      (hasFooter ? `<Relationship Id="rId7" Type="${rt}/footer" Target="footer1.xml"/>` : "") +
      v.rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${xmlEsc(r.target)}"${r.external ? ' TargetMode="External"' : ""}/>`).join("") +
      `</Relationships>`;

    const para = (inner: string, jc: string) => `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr>${inner}</w:p>`;
    const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${para(`<w:r><w:t xml:space="preserve">${xmlEsc(doc.page.header)}</w:t></w:r>`, "left")}</w:hdr>`;
    const pageField = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${para(
      `<w:r><w:t xml:space="preserve">${xmlEsc(doc.page.footer)}${doc.page.footer && doc.page.pageNumbers ? "  " : ""}</w:t></w:r>${doc.page.pageNumbers ? pageField : ""}`,
      "center"
    )}</w:ftr>`;

    const iso = (t: number) => new Date(t).toISOString().replace(/\.\d+Z$/, "Z");
    const core =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${xmlEsc(doc.meta.title)}</dc:title><dc:creator>${xmlEsc(doc.meta.author)}</dc:creator><dc:description>${xmlEsc(doc.meta.description)}</dc:description>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${iso(doc.meta.createdAt)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso(doc.meta.updatedAt)}</dcterms:modified></cp:coreProperties>`;

    const zip = new ZipWriter()
      .add("[Content_Types].xml", ct)
      .add(
        "_rels/.rels",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rt}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
      )
      .add("docProps/core.xml", core)
      .add("word/document.xml", document)
      .add("word/_rels/document.xml.rels", docRels)
      .add("word/styles.xml", styles())
      .add("word/numbering.xml", numbering());
    if (hasHeader) zip.add("word/header1.xml", header);
    if (hasFooter) zip.add("word/footer1.xml", footer);
    v.media.forEach((mm) => zip.add(`word/media/${mm.name}`, mm.bytes));

    return {
      filename: safeFilename(doc.meta.title, "docx"),
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      data: zip.finish(),
    };
  }
}
