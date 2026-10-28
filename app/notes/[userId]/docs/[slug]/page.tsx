import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS } from "@/lib/docs/generated";
import { makeLinkResolver } from "@/lib/docs/library";
import { renderMarkdown } from "@/lib/docs/markdown";
import { DocContent } from "@/components/Notes/DocContent";
import { PublicShell } from "@/components/Notes/PublicShell";

/** Public (no login): one project document, shown as a web page. */
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
  return (
    <PublicShell userId={params.userId}>
      <DocContent html={html} />
    </PublicShell>
  );
}
