"use client";

import { useInertiaScroll } from "@/components/ReadingMode/useInertiaScroll";
import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListTree } from "lucide-react";
import { MermaidViewer } from "@/components/Notes/MermaidViewer";
import type { Heading as DocHeading } from "@/lib/docs/markdown";

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
  "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-overlay/10 [&_pre]:bg-canvas-raised [&_pre]:p-5 [&_pre]:text-[15px] [&_pre]:leading-7 sm:[&_pre]:text-base",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[1em] [&_pre_code]:text-ink",
  "[&_blockquote]:my-6 [&_blockquote]:rounded-2xl [&_blockquote]:border-l-4 [&_blockquote]:border-overlay/20 [&_blockquote]:bg-canvas-raised [&_blockquote]:px-5 [&_blockquote]:py-1",
  "[&_.anchor]:ml-2 [&_.anchor]:text-ink-muted/40 [&_.anchor]:no-underline [&_.anchor]:opacity-0 hover:[&_.anchor]:opacity-100 [&_h2:hover_.anchor]:opacity-100 [&_h3:hover_.anchor]:opacity-100 [&_h2]:scroll-mt-20 [&_h3]:scroll-mt-20",
  "[&_hr]:my-10 [&_hr]:border-overlay/10",
  "[&_.table-wrap]:my-6 [&_.table-wrap]:overflow-x-auto [&_.table-wrap]:rounded-2xl [&_.table-wrap]:border [&_.table-wrap]:border-overlay/10",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm",
  "[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-overlay/10 [&_th]:bg-canvas-raised [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-ink",
  "[&_td]:border-b [&_td]:border-overlay/10 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:text-ink-muted [&_tr:last-child_td]:border-b-0",
].join(" ");


const CSS = `
.doc-prose mark.hl{background:transparent;color:inherit;padding:0}
.doc-prose .doc-figure{margin:2rem 0;text-align:center}
.doc-prose .doc-figure img{max-width:100%;height:auto;border-radius:1rem;border:1px solid rgba(128,128,128,.25);background:#fff;display:inline-block}
.doc-prose .doc-figure figcaption{margin-top:.6rem;font-size:.85rem;opacity:.7}
.doc-prose .doc-embed{margin:2rem 0;text-align:center}
.doc-prose .doc-embed iframe{max-width:100%;border:1px solid rgba(128,128,128,.25);border-radius:1rem;background:#fff}
.doc-prose .doc-embed figcaption{margin-top:.5rem;font-size:.85rem}
.doc-prose em{font-style:italic}

.doc-prose .doc-code{margin:1.5rem 0;overflow:hidden;border-radius:1rem;border:1px solid rgb(var(--overlay-rgb,128 128 128)/.18);background:var(--code-bg,#f6f8fa)}
.doc-prose .doc-code pre{margin:0;border:0;border-radius:0;background:transparent;padding:1.1rem 1.25rem;font-size:15px;line-height:1.75;tab-size:2}
.doc-prose .doc-code figcaption{display:flex;align-items:center;gap:.75rem;padding:.55rem .9rem;font-size:.8rem;border-bottom:1px solid rgba(128,128,128,.2);background:rgba(128,128,128,.08)}
.doc-prose .code-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit}
.doc-prose .code-lang{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;opacity:.6}
.doc-prose .code-copy{border:1px solid rgba(128,128,128,.3);border-radius:999px;padding:.1rem .65rem;font-size:.75rem;cursor:pointer;background:transparent;color:inherit}
.doc-prose .code-copy:hover{background:rgba(128,128,128,.15)}
.doc-prose .code-principle{padding:.65rem .9rem;font-size:.85rem;line-height:1.5;border-top:1px solid rgba(128,128,128,.2);background:rgba(48,111,219,.08)}
.doc-prose .code-principle strong{margin-right:.4rem;color:#306fdb;font-weight:650;text-transform:uppercase;font-size:.7rem;letter-spacing:.06em}
.doc-prose pre{white-space:pre;tab-size:2}
.doc-prose .tk-c{color:#6a737d;font-style:italic}
.doc-prose .tk-s{color:#0a7a3d}
.doc-prose .tk-n{color:#b35c00}
.doc-prose .tk-k{color:#cf222e}
.doc-prose .tk-l{color:#0550ae}
.doc-prose .tk-t{color:#8250df}
.doc-prose .tk-f{color:#0969da}
.doc-prose .tk-p{color:#953800}
.doc-prose .tk-v{color:#b35c00}
:root[data-theme="dark"] .doc-prose .doc-code{background:#0d1117}
:root[data-theme="dark"] .doc-prose .tk-c{color:#8b949e}
:root[data-theme="dark"] .doc-prose .tk-s{color:#a5d6ff}
:root[data-theme="dark"] .doc-prose .tk-n{color:#79c0ff}
:root[data-theme="dark"] .doc-prose .tk-k{color:#ff7b72}
:root[data-theme="dark"] .doc-prose .tk-l{color:#79c0ff}
:root[data-theme="dark"] .doc-prose .tk-t{color:#d2a8ff}
:root[data-theme="dark"] .doc-prose .tk-f{color:#d2a8ff}
:root[data-theme="dark"] .doc-prose .tk-p{color:#ffa657}
:root[data-theme="dark"] .doc-prose .tk-v{color:#ffa657}
`;

/**
 * A document as a page: Mermaid blocks become interactive diagrams, code blocks get a Copy button,
 * and there is an "On this page" list.
 */
export function DocContent({ html, headings = [], minutes }: { html: string; slug?: string; headings?: DocHeading[]; minutes?: number }) {
  const ref = useRef<HTMLElement>(null);
  const [diagrams, setDiagrams] = useState<{ el: HTMLElement; source: string }[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  useInertiaScroll(true); // the same eased wheel / key scrolling as the reading page

  // Mount the diagram viewers into the placeholders the renderer left.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    setDiagrams(
      Array.from(root.querySelectorAll<HTMLElement>(".doc-diagram")).map((el) => {
        const source = el.getAttribute("data-diagram") ?? "";
        el.textContent = "";
        return { el, source };
      })
    );
  }, [html]);

  const onArticleClick = (e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".code-copy");
    if (!btn) return;
    const code = btn.closest("figure")?.querySelector("pre")?.textContent ?? "";
    navigator.clipboard?.writeText(code).then(() => {
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = "Copy"; }, 1500);
    }).catch(() => undefined);
  };

  const toc = headings.filter((h) => h.level >= 2 && h.level <= 3);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {(minutes || toc.length > 1) && (
        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
          {minutes ? <span>{minutes} min read</span> : null}
          {toc.length > 1 && (
            <button type="button" onClick={() => setTocOpen((v) => !v)} aria-expanded={tocOpen} className="inline-flex items-center gap-1.5 rounded-full border border-overlay/15 px-3 py-1 text-ink transition-colors hover:bg-overlay/10">
              <ListTree className="h-4 w-4" /> On this page
            </button>
          )}
        </div>
      )}
      {tocOpen && (
        <nav aria-label="On this page" className="mb-10 rounded-[32px] border border-overlay/10 bg-canvas-raised p-6">
          <ul className="space-y-1.5">
            {toc.map((h) => (
              <li key={h.id} style={{ paddingLeft: (h.level - 2) * 16 }}>
                <a href={`#${h.id}`} className="text-base text-ink-muted transition-colors hover:text-[#306fdb]">{h.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <article ref={ref} onClick={onArticleClick} className={`doc-prose min-w-0 [overflow-wrap:anywhere] ${PROSE}`} dangerouslySetInnerHTML={{ __html: html }} />
      {diagrams.map((d, i) => createPortal(<MermaidViewer source={d.source} />, d.el, `d${i}`))}
    </>
  );
}
