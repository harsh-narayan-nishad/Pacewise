import { DOC_INDEX, type DocMeta } from "@/lib/docs/index.generated";

export interface DocFolder { id: string; label: string; docs: DocMeta[] }

const FOLDER_LABELS: Record<string, string> = { "": "Project docs", interview: "Interview prep" };

/** Docs grouped by folder (root first), in file-name order, for the menu and the notes index. */
export function docFolders(): DocFolder[] {
  const ids = Array.from(new Set(DOC_INDEX.map((d) => d.folder))).sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  return ids.map((id) => ({
    id,
    label: FOLDER_LABELS[id] ?? id.replace(/[-_/]/g, " ").replace(/^./, (c) => c.toUpperCase()),
    docs: DOC_INDEX.filter((d) => d.folder === id),
  }));
}

export const docUrl = (userId: string, slug: string) => `/notes/${encodeURIComponent(userId)}/docs/${slug}`;

/** Turns a Markdown link like "../STORY_PAGE.md#x" into the page that shows that doc; other links are left alone. */
export function makeLinkResolver(userId: string): (href: string) => string | null {
  return (href) => {
    const [target, hash] = href.split("#");
    if (!target.endsWith(".md")) return null;
    const wanted = target.replace(/^(\.\/|\.\.\/)+/, "").toLowerCase();
    const hit = DOC_INDEX.find((d) => d.path.toLowerCase() === wanted) ?? DOC_INDEX.find((d) => d.path.toLowerCase().endsWith("/" + wanted.split("/").pop()) || d.path.toLowerCase() === wanted.split("/").pop());
    return hit ? docUrl(userId, hit.slug) + (hash ? `#${hash}` : "") : null;
  };
}
