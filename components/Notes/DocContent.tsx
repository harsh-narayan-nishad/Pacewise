import React from "react";

/** The look of a rendered document: display headings, readable body, scrollable tables and code. */
const PROSE = [
  "text-base leading-relaxed text-ink sm:text-lg",
  "[&_h1]:mb-6 [&_h1]:font-display [&_h1]:text-4xl [&_h1]:leading-tight [&_h1]:tracking-[-0.03em] sm:[&_h1]:text-5xl",
  "[&_h2]:mb-4 [&_h2]:mt-14 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:tracking-[-0.03em] sm:[&_h2]:text-4xl",
  "[&_h3]:mb-3 [&_h3]:mt-10 [&_h3]:font-display [&_h3]:text-2xl [&_h3]:tracking-[-0.02em]",
  "[&_h4]:mb-2 [&_h4]:mt-8 [&_h4]:text-lg [&_h4]:font-medium",
  "[&_p]:my-4 [&_p]:text-ink-muted",
  "[&_strong]:font-semibold [&_strong]:text-ink",
  "[&_a]:text-[#306fdb] [&_a]:underline-offset-4 hover:[&_a]:underline",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:text-ink-muted [&_li>ul]:my-1 [&_li>ol]:my-1",
  "[&_code]:rounded-md [&_code]:bg-overlay/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-ink",
  "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-overlay/10 [&_pre]:bg-canvas-raised [&_pre]:p-5 [&_pre]:text-sm",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-ink-muted",
  "[&_blockquote]:my-6 [&_blockquote]:rounded-2xl [&_blockquote]:border-l-4 [&_blockquote]:border-overlay/20 [&_blockquote]:bg-canvas-raised [&_blockquote]:px-5 [&_blockquote]:py-1",
  "[&_hr]:my-10 [&_hr]:border-overlay/10",
  "[&_.table-wrap]:my-6 [&_.table-wrap]:overflow-x-auto [&_.table-wrap]:rounded-2xl [&_.table-wrap]:border [&_.table-wrap]:border-overlay/10",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm",
  "[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-overlay/10 [&_th]:bg-canvas-raised [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-ink",
  "[&_td]:border-b [&_td]:border-overlay/10 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:text-ink-muted [&_tr:last-child_td]:border-b-0",
].join(" ");

/** Renders HTML produced by lib/docs/markdown.ts (already escaped there). */
export function DocContent({ html }: { html: string }) {
  return <article className={`min-w-0 [overflow-wrap:anywhere] ${PROSE}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
