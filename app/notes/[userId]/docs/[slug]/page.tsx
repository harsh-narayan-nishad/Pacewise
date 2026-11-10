import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS } from "@/lib/docs/generated";
import { adjacentDocs, docCrumbs, docUrl, makeLinkResolver } from "@/lib/docs/library";
import { allHeadingIds, extractHeadings, readingMinutes, renderMarkdown } from "@/lib/docs/markdown";
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
  const resolveLink = makeLinkResolver(params.userId);
  const html = renderMarkdown(doc.md, { resolveLink });
  // The Hindi version (docs/<name>.hi.md), if there is one. Its headings reuse the English ids, so "#section" links work in both.
  const enIds = allHeadingIds(doc.md);
  const hi = doc.hi
    ? (() => {
        const ids = allHeadingIds(doc.hi.md).length === enIds.length ? enIds : undefined;
        return { html: renderMarkdown(doc.hi.md, { resolveLink, headingIds: ids ? [...ids] : undefined }), headings: extractHeadings(doc.hi.md, ids), minutes: readingMinutes(doc.hi.md) };
      })()
    : undefined;
  const { prev, next } = adjacentDocs(doc.slug);
  const crumbs = docCrumbs(params.userId, doc.slug);
  const crumbsHi = docCrumbs(params.userId, doc.slug, "hi");
  const { prev: prevHi, next: nextHi } = adjacentDocs(doc.slug, "hi");
  const toTarget = (d?: { slug: string; title: string }) => (d ? { href: docUrl(params.userId, d.slug), title: d.title } : undefined);
  return (
    <>
    <PublicShell userId={params.userId} autoHideNav>
      <DocBreadcrumb crumbs={crumbs} crumbsHi={crumbsHi} className="mb-3" />
      <DocContent html={html} slug={doc.slug} headings={extractHeadings(doc.md)} minutes={readingMinutes(doc.md)} hi={hi} />
      <DocTimeTracker slug={doc.slug} title={doc.title} />
      <DocNav prev={toTarget(prev)} next={toTarget(next)} prevHi={toTarget(prevHi)} nextHi={toTarget(nextHi)} />
    </PublicShell>
    {/* The path again, just above the footer line, on the footer's own left edge. */}
    <div className="mx-auto -mt-16 max-w-6xl px-6 pb-5 sm:px-8">
      <DocBreadcrumb crumbs={crumbs} crumbsHi={crumbsHi} />
    </div>
    </>
  );
}
