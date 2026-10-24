import { RichDocument } from "@/lib/editor/model/RichDocument";
import { TextImporter } from "@/lib/editor/import/Importers";

interface StoryLike {
  title?: string;
  story?: Array<{ paragraph: string }>;
  richDocument?: unknown;
}

/**
 * Adapter between a story and the editor. The reading engine keeps
 * consuming `story: [{paragraph}]`; the rich document rides along as an
 * optional snapshot. If the plain paragraphs were changed elsewhere (for
 * example in the JSON tab) the snapshot is stale and is ignored, so the
 * text the reader shows is always the source of truth.
 */
export function docFromStory(s: StoryLike): RichDocument {
  const plain = (s.story ?? []).map((p) => p.paragraph);
  const rich = s.richDocument ? RichDocument.fromSnapshot(s.richDocument) : null;
  if (rich && rich.toReadingParagraphs().join("\n\n") === plain.join("\n\n")) return rich;
  return new TextImporter().import(plain.join("\n\n"), s.title || "Untitled document");
}

export function storyPartsFromDoc(doc: RichDocument): { story: Array<{ paragraph: string }>; richDocument: unknown; wordCount: number } {
  const paras = doc.toReadingParagraphs();
  return {
    story: paras.map((paragraph) => ({ paragraph })),
    richDocument: doc.snapshot(),
    wordCount: paras.reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0),
  };
}

/** The story's rich snapshot, but only while it still matches the plain
 *  paragraphs the reading engine counts (same rule as `docFromStory`). */
export function richDocFor(s: StoryLike): RichDocument | null {
  if (!s.richDocument) return null;
  const rich = RichDocument.fromSnapshot(s.richDocument);
  if (!rich) return null;
  const plain = (s.story ?? []).map((p) => p.paragraph).join("\n\n");
  return rich.toReadingParagraphs().join("\n\n") === plain ? rich : null;
}
