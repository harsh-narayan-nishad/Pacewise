import { DOC_INDEX, type DocMeta } from "@/lib/docs/index.generated";

export interface DocFolder { id: string; label: string; docs: DocMeta[] }

const FOLDER_LABELS: Record<string, string> = { "": "Project docs", interview: "Interview prep", research: "Research", syllabus: "Syllabus", "system-design": "Case studies", "syllabus/03-methodologies": "Methodologies", "syllabus/06-system-design": "System Design" };

/** Docs grouped by folder (root first), in file-name order, for the menu and the notes index. */
export function docFolders(): DocFolder[] {
  const ids = Array.from(new Set(DOC_INDEX.map((d) => d.folder))).sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  return ids.map((id) => ({
    id,
    label: FOLDER_LABELS[id] ?? id.replace(/[-_/]/g, " ").replace(/^./, (c) => c.toUpperCase()),
    docs: DOC_INDEX.filter((d) => d.folder === id),
  }));
}

/** Pages that exist but are not listed in the menu (so "Next" skips them too). */
export const HIDDEN_IN_MENU = new Set(["syllabus--07-research-references"]);

/** Menu order inside docs/syllabus: Core CSE first, then Overview, then the chapters by number. */
export const syllabusOrder = (slug: string): number => {
  if (slug === "syllabus--04-cn-os-oops-dbms-utilization") return 0;
  if (slug.endsWith("--readme")) return 1;
  return 1 + Number(slug.replace(/^syllabus(--|\/)/, "").match(/^\d+/)?.[0] ?? 998);
};

/** The pages before and after this one in the same folder, in menu order. */
export function adjacentDocs(slug: string): { prev?: DocMeta; next?: DocMeta } {
  const me = DOC_INDEX.find((d) => d.slug === slug);
  if (!me) return {};
  const siblings = DOC_INDEX.filter((d) => d.folder === me.folder && !HIDDEN_IN_MENU.has(d.slug));
  if (me.folder === "syllabus") siblings.sort((a, b) => syllabusOrder(a.slug) - syllabusOrder(b.slug));
  const i = siblings.findIndex((d) => d.slug === slug);
  return i < 0 ? {} : { prev: siblings[i - 1], next: siblings[i + 1] };
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
