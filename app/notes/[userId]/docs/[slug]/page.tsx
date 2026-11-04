import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS } from "@/lib/docs/generated";
import { adjacentDocs, docCrumbs, docUrl, makeLinkResolver } from "@/lib/docs/library";
import { extractHeadings, readingMinutes, renderMarkdown } from "@/lib/docs/markdown";
import { DocContent } from "@/components/Notes/DocContent";
import { DocTimeTracker } from "@/components/Notes/DocTimeTracker";
import { DocBreadcrumb } from "@/components/Notes/DocBreadcrumb";
import { DocNav } from "@/components/Notes/DocNav";
import { PublicShell } from "@/components/Notes/PublicShell";

/** Sign-in required: one project document, shown as a web page. */
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const doc = DOCS.find((d) => d.slug === params.slug);
  return { title: doc?.title ?? "Document" };
}

export default function DocPage({ params }: { params: { userId: string; slug: string } }) {
  const doc = DOCS.find((d) => d.slug === params.slug);
  if (!doc) {
    notFound();
    return null;
  }
  const html = renderMarkdown(doc.md, { resolveLink: makeLinkResolver(params.userId) });
  const { prev, next } = adjacentDocs(doc.slug);
  const crumbs = docCrumbs(params.userId, doc.slug);
  const toTarget = (d?: { slug: string; title: string }) => (d ? { href: docUrl(params.userId, d.slug), title: d.title } : undefined);
  return (
    <PublicShell userId={params.userId} autoHideNav>
      <DocBreadcrumb crumbs={crumbs} className="mb-3" />
      <DocContent html={html} slug={doc.slug} headings={extractHeadings(doc.md)} minutes={readingMinutes(doc.md)} />
      <DocTimeTracker slug={doc.slug} title={doc.title} />
      <DocNav prev={toTarget(prev)} next={toTarget(next)} />
      <DocBreadcrumb crumbs={crumbs} className="-mb-24 mt-8 pb-5" />
    </PublicShell>
  );
}
