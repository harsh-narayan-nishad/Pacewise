import { DOC_INDEX, type DocMeta } from "@/lib/docs/index.generated";
import { FOLDER_LABELS_HI } from "@/lib/docs/i18n";
import type { DocsLang } from "@/lib/docs/lang";

export interface DocFolder { id: string; label: string; docs: DocMeta[] }

const FOLDER_LABELS: Record<string, string> = {
  "": "Project docs",
  interview: "Interview prep",
  research: "Research",
  syllabus: "Syllabus",
  "system-design": "Case studies",
  "leadership-principles": "Leadership principles",
  "leadership-principles/amazon": "Amazon's Leadership",
  "leadership-principles/google": "Google's Leadership",
  "leadership-principles/uber": "Uber's Leadership",
  "leadership-principles/netflix": "Netflix's Leadership",
  "leadership-principles/apple": "Apple's Leadership",
  "daa-notes": "DAA notes",
  "syllabus/03-methodologies": "Methodologies",
  "syllabus/04-core-cse": "Core CSE",
  "syllabus/04-core-cse/cn": "CN",
  "syllabus/04-core-cse/os": "OS",
  "syllabus/04-core-cse/dbms": "DBMS",
  "syllabus/04-core-cse/oops": "OOPs",
  "syllabus/06-system-design": "System Design",
};

/** Folders that sit on disk at the top of docs/ but are shown inside another folder in the menu ("" = Project docs). */
export const FOLDER_PARENT: Readonly<Record<string, string>> = { "daa-notes": "" };

/** Docs grouped by folder (root first), in file-name order, for the menu and the notes index. */
/** `lang` "hi" gives Hindi folder names and page titles (a page without a Hindi version keeps its English title). */
export const localTitle = <T extends { title: string; titleHi?: string }>(d: T, lang: DocsLang): string => (lang === "hi" ? d.titleHi ?? d.title : d.title);

export function docFolders(lang: DocsLang = "en"): DocFolder[] {
  const ids = Array.from(new Set(DOC_INDEX.map((d) => d.folder))).sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  return ids.map((id) => ({
    id,
    label: (lang === "hi" ? FOLDER_LABELS_HI[id] : undefined) ?? FOLDER_LABELS[id] ?? id.replace(/[-_/]/g, " ").replace(/^./, (c) => c.toUpperCase()),
    docs: DOC_INDEX.filter((d) => d.folder === id).map((d) => (lang === "hi" && d.titleHi ? { ...d, title: d.titleHi } : d)),
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
export function adjacentDocs(slug: string, lang: DocsLang = "en"): { prev?: DocMeta; next?: DocMeta } {
  const me = DOC_INDEX.find((d) => d.slug === slug);
  if (!me) return {};
  const siblings = DOC_INDEX.filter((d) => d.folder === me.folder && !HIDDEN_IN_MENU.has(d.slug));
  if (me.folder === "syllabus") siblings.sort((a, b) => syllabusOrder(a.slug) - syllabusOrder(b.slug));
  const i = siblings.findIndex((d) => d.slug === slug);
  const show = (d?: DocMeta) => (d && lang === "hi" && d.titleHi ? { ...d, title: d.titleHi } : d);
  return i < 0 ? {} : { prev: show(siblings[i - 1]), next: show(siblings[i + 1]) };
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

export interface FooterColumn { title: string; links: Array<{ label: string; href: string }> }

/** Footer link columns for the public docs pages: they route to the docs, not to the signed-in app. */
export function docsFooterColumns(userId: string, perColumn = 6): FooterColumn[] {
  const folders = docFolders();
  const link = (d: DocMeta) => ({ label: d.slug.endsWith("--readme") && d.folder === "syllabus" ? "Overview" : d.title, href: docUrl(userId, d.slug) });
  const shown = (docs: DocMeta[]) => docs.filter((d) => !HIDDEN_IN_MENU.has(d.slug)).slice(0, perColumn).map(link);
  const syllabus = folders
    .filter((f) => f.id === "syllabus" || f.id.startsWith("syllabus/"))
    .flatMap((f) => f.docs)
    .filter((d) => !HIDDEN_IN_MENU.has(d.slug))
    .sort((a, b) => syllabusOrder(a.slug) - syllabusOrder(b.slug));
  const documents = folders.filter((f) => f.id !== "syllabus" && !f.id.startsWith("syllabus/") && f.id !== "research" && f.id !== "interview").flatMap((f) => f.docs);
  return [
    { title: "Syllabus", links: shown(syllabus) },
    { title: "Documents", links: shown(documents) },
    { title: "Research", links: shown(folders.find((f) => f.id === "research")?.docs ?? []) },
    { title: "Interview prep", links: shown(folders.find((f) => f.id === "interview")?.docs ?? []) },
  ].filter((c) => c.links.length > 0);
}

export interface Crumb { label: string; href?: string }

/** "Folder > Tab > Page" for the page being read. Every part but the last links to the first page of that level. */
export function docCrumbs(userId: string, slug: string, lang: DocsLang = "en"): Crumb[] {
  const me = DOC_INDEX.find((d) => d.slug === slug);
  if (!me) return [];
  const hi = lang === "hi";
  const named = (id: string) => (hi ? FOLDER_LABELS_HI[id] : undefined) ?? FOLDER_LABELS[id];
  const folders = docFolders(lang);
  const crumbs: Crumb[] = [];
  const parts = me.folder === "" ? [] : me.folder.split("/");
  parts.forEach((_, i) => {
    const id = parts.slice(0, i + 1).join("/");
    const label = named(id) ?? id.split("/").pop()!.replace(/^\d+-/, "").replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());
    // First page of this level, in menu order: the folder's own pages, else the first page below it.
    const inside = DOC_INDEX.filter((d) => (d.folder === id || d.folder.startsWith(id + "/")) && !HIDDEN_IN_MENU.has(d.slug));
    const ordered = id.startsWith("syllabus") ? [...inside].sort((a, b) => syllabusOrder(a.slug) - syllabusOrder(b.slug)) : inside;
    const own = ordered.filter((d) => d.folder === id);
    const first = (own[0] ?? ordered[0]);
    crumbs.push({ label: folders.find((f) => f.id === id)?.label ?? label, href: first ? docUrl(userId, first.slug) : undefined });
  });
  if (me.folder === "") crumbs.push({ label: named("") });
  if (me.folder in FOLDER_PARENT) {
    const parent = FOLDER_PARENT[me.folder];
    const first = DOC_INDEX.find((d) => d.folder === parent && !HIDDEN_IN_MENU.has(d.slug));
    crumbs.unshift({ label: named(parent) ?? parent, href: first ? docUrl(userId, first.slug) : undefined });
  }
  crumbs.push({ label: me.slug.endsWith("--readme") && me.folder === "syllabus" ? (hi ? "ओवरव्यू" : "Overview") : localTitle(me, lang) });
  return crumbs;
}
