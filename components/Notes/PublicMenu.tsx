"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, FileText, Menu, X } from "lucide-react";
import { docFolders, docUrl } from "@/lib/docs/library";
import { BRAND_NAME } from "@/lib/brand";

/** Same large display-type row as the app's menu: label, divider, chevron. */
function BigRow({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between py-3 text-left">
      <span className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-4xl">{label}</span>
      <span className="flex items-center gap-4">
        <span aria-hidden className="h-9 w-px bg-overlay/15" />
        <ChevronRight className={`h-5 w-5 text-ink transition-transform ${open ? "rotate-90" : ""}`} />
      </span>
    </button>
  );
}

const LABEL = "mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted";
const SECTION = "mt-8 first:mt-0";
const CORE_CSE_SLUG = "syllabus--04-cn-os-oops-dbms-utilization"; // "Core CSE": opens the CN, OS, OOP, DBMS notes
const HIDDEN_IN_MENU = new Set(["syllabus--07-research-references"]);

/** An expandable folder row (big heading + chevron) listing its documents. */
function FolderRow({ label, docs, open, onToggle, userId, current }: { label: string; docs: { slug: string; title: string }[]; open: boolean; onToggle: () => void; userId: string; current?: string }) {
  return (
    <div>
      <BigRow label={label} open={open} onToggle={onToggle} />
      {open && (
        <ul className="mb-4 mt-1 space-y-0.5">
          {docs.map((d) => (
            <li key={d.slug}>
              <Link href={docUrl(userId, d.slug)} aria-current={current === d.slug ? "page" : undefined} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 text-base transition-colors hover:bg-overlay/5 ${current === d.slug ? "bg-overlay/[0.08] text-ink" : "text-ink-muted hover:text-ink"}`}>
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">{d.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A direct-link row (big heading, divider, chevron) for a syllabus chapter. */
function LinkRow({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className="group flex w-full items-center justify-between py-3">
      <span className="font-display text-3xl leading-tight tracking-[-0.03em] text-ink transition-opacity group-hover:opacity-70 sm:text-4xl">{label}</span>
      <span className="flex items-center gap-4">
        <span aria-hidden className="h-9 w-px bg-overlay/15" />
        <ChevronRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 ${active ? "text-[#306fdb]" : "text-ink"}`} />
      </span>
    </Link>
  );
}

/**
 * The hamburger on the public notes pages: the app menu without anything personal (no playlists,
 * search history, uploads or sign-out), plus every docs folder. Opening a folder lists its documents;
 * choosing one shows it as a page.
 */
export function PublicMenu({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const all = docFolders();
  const folders = all.filter((f) => f.id !== "research" && f.id !== "syllabus" && f.id !== "interview");
  const interview = all.find((f) => f.id === "interview");
  const syllabus = all.find((f) => f.id === "syllabus");
  const research = all.find((f) => f.id === "research");
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  // Open the folder of the document being read.
  useEffect(() => {
    const slug = pathname?.split("/docs/")[1];
    const hit = all.find((f) => f.docs.some((d) => d.slug === slug));
    if (hit) setOpenFolder(hit.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const current = pathname?.split("/docs/")[1];

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu" aria-haspopup="dialog" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink">
        <Menu className="h-5 w-5" />
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-modal-backdrop bg-[rgb(var(--shadow-color))]/50" onClick={() => setOpen(false)} />
                <motion.div
                  role="dialog"
                  aria-label="Notes and documents"
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  className="fixed inset-y-0 left-0 z-drawer flex w-[92vw] max-w-md flex-col border-r border-overlay/10 bg-canvas shadow-themed"
                >
                  <div className="flex items-center justify-between px-6 pb-2 pt-5">
                    <span className="text-[13px] font-medium tracking-tight text-ink">{BRAND_NAME}</span>
                    <button onClick={() => setOpen(false)} aria-label="Close menu" className="shrink-0 rounded-full p-2 text-ink transition-colors hover:bg-overlay/10">
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <nav className="flex-1 overflow-y-auto px-6 pb-8 pt-4" aria-label="Notes navigation">
                    {syllabus && (
                      <section aria-label="Syllabus" className={SECTION}>
                        <div className={LABEL}>Syllabus</div>
                        {syllabus.docs
                          .filter((d) => !HIDDEN_IN_MENU.has(d.slug))
                          .sort((a, b) => Number(a.slug.endsWith("--readme")) - Number(b.slug.endsWith("--readme")))
                          .map((d) => {
                            const isIndex = d.slug.endsWith("--readme");
                            if (d.slug === CORE_CSE_SLUG) {
                              const notesHref = `/notes/${encodeURIComponent(userId)}`;
                              return <LinkRow key={d.slug} label="Core CSE" href={notesHref} active={pathname === notesHref} />;
                            }
                            return <LinkRow key={d.slug} label={isIndex ? "Overview" : d.title.replace(/^\d+\.\s*/, "")} href={docUrl(userId, d.slug)} active={current === d.slug} />;
                          })}
                      </section>
                    )}

                    {folders.length > 0 && (
                      <section aria-label="Documents" className={SECTION}>
                        <div className={LABEL}>Documents</div>
                        {folders.map((f) => (
                          <FolderRow key={f.id || "root"} label={f.label} docs={f.docs} open={openFolder === f.id} onToggle={() => setOpenFolder(openFolder === f.id ? null : f.id)} userId={userId} current={current} />
                        ))}
                      </section>
                    )}

                    {research && (
                      <section aria-label="Research" className={SECTION}>
                        <div className={LABEL}>Research</div>
                        <FolderRow label="Research" docs={research.docs} open={openFolder === "research"} onToggle={() => setOpenFolder(openFolder === "research" ? null : "research")} userId={userId} current={current} />
                      </section>
                    )}

                    {interview && (
                      <section aria-label="Interview prep" className={SECTION}>
                        <div className={LABEL}>Interview</div>
                        <FolderRow label={interview.label} docs={interview.docs} open={openFolder === interview.id} onToggle={() => setOpenFolder(openFolder === interview.id ? null : interview.id)} userId={userId} current={current} />
                      </section>
                    )}

                    <div className="mt-10 border-t border-overlay/10 pt-5">
                      <Link href="/" className="text-base text-ink transition-opacity hover:opacity-70">Open {BRAND_NAME}</Link>
                    </div>
                  </nav>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
