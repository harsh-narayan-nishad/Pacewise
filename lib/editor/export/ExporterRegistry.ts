import { DocumentExporter } from "@/lib/editor/export/Exporter";
import { DocxExporter } from "@/lib/editor/export/DocxExporter";
import { HtmlExporter, MarkdownExporter, TextExporter } from "@/lib/editor/export/TextExporters";

/** Open/Closed: register another `DocumentExporter` to add a format. */
export class ExporterRegistry {
  private readonly map = new Map<string, DocumentExporter>();
  constructor(exporters: DocumentExporter[] = [new DocxExporter(), new MarkdownExporter(), new HtmlExporter(), new TextExporter()]) {
    exporters.forEach((e) => this.register(e));
  }
  register(e: DocumentExporter): this {
    this.map.set(e.id, e);
    return this;
  }
  get(id: string): DocumentExporter {
    const e = this.map.get(id);
    if (!e) throw new Error(`No exporter registered for "${id}"`);
    return e;
  }
  list(): DocumentExporter[] {
    return Array.from(this.map.values());
  }
}
