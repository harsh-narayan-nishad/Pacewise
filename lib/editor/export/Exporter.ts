import { RichDocument } from "@/lib/editor/model/RichDocument";

export interface ExportResult {
  readonly filename: string;
  readonly mime: string;
  readonly data: string | Uint8Array;
}

/** Strategy interface: one class per output format. */
export interface DocumentExporter {
  readonly id: string;
  readonly label: string;
  readonly extension: string;
  export(doc: RichDocument, resolveImage?: ImageResolver): ExportResult | Promise<ExportResult>;
}

/** Maps an `sr-img:<id>` / data URL to bytes (for DOCX embedding). */
export type ImageResolver = (src: string) => { bytes: Uint8Array; mime: string } | null;

export function safeFilename(title: string, ext: string): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim().replace(/\s+/g, "-").slice(0, 80) || "document";
  return `${base}.${ext}`;
}
