"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, FileText, Menu, X } from "lucide-react";
import { docFolders, docUrl, FOLDER_PARENT, HIDDEN_IN_MENU, syllabusOrder } from "@/lib/docs/library";
import { BRAND_NAME } from "@/lib/brand";
import { TickSpinner } from "@/components/ui/loaders/TickSpinner";

/** True from the click on a menu link until the new page arrives, but only once the wait passes 150 ms (quicker loads never show it). */
function useLinkPending(href: string): { pending: boolean; onClick: (e: React.MouseEvent) => void } {
  const pathname = usePathname();
  const [clicked, setClicked] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => { setClicked(false); setPending(false); }, [pathname]);
  useEffect(() => {
    if (!clicked) return;
    const id = window.setTimeout(() => setPending(true), 150);
    return () => window.clearTimeout(id);
  }, [clicked]);
  return { pending, onClick: (e) => { if (href.split(/[?#]/)[0] !== pathname && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) setClicked(true); } };
}

/** Same large display-type row as the app's menu: label, divider, chevron. */
function BigRow({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between py-3 text-left">
      <span className="font-display text-[34px] leading-[1.1] tracking-[-0.035em] text-ink sm:text-4xl sm:leading-tight sm:tracking-[-0.03em]">{label}</span>
      <span className="flex items-center gap-4">
        <span aria-hidden className="h-9 w-px bg-overlay/15" />
        <ChevronRight className={`h-5 w-5 text-ink transition-transform ${open ? "rotate-90" : ""}`} />
      </span>
    </button>
  );
}

const LABEL = "mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted";
const SECTION = "mt-6 border-t border-overlay/10 pt-6 first:mt-0 first:border-t-0 first:pt-0"; // a thin line between sections, like the app menu
const CORE_CSE_SLUG = "syllabus--04-cn-os-oops-dbms-utilization"; // "Core CSE": opens the CN, OS, OOP, DBMS notes

/** One document row of a folder; a small spinner replaces the file icon while its page loads. */
function DocItem({ href, title, active }: { href: string; title: string; active: boolean }) {
  const { pending, onClick } = useLinkPending(href);
  return (
    <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} aria-busy={pending} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 text-base transition-colors hover:bg-overlay/5 ${active ? "bg-overlay/[0.08] text-ink" : "text-ink-muted hover:text-ink"}`}>
      {pending ? <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center"><TickSpinner size={16} label="Loading page" /></span> : <FileText className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="min-w-0">{title}</span>
    </Link>
  );
}

/** An expandable folder row (big heading + chevron) listing its documents. */
function FolderRow({ label, docs, open, onToggle, userId, current }: { label: string; docs: { slug: string; title: string }[]; open: boolean; onToggle: () => void; userId: string; current?: string }) {
  // A folder with a single page needs no second click: the row opens that page directly.
  if (docs.length === 1) return <LinkRow label={label} href={docUrl(userId, docs[0].slug)} active={current === docs[0].slug} />;
  return (
    <div>
      <BigRow label={label} open={open} onToggle={onToggle} />
      {open && (
        <ul className="mb-4 mt-1 space-y-0.5">
          {docs.map((d) => (
            <li key={d.slug}>
              <DocItem href={docUrl(userId, d.slug)} title={d.title} active={current === d.slug} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A folder that also holds sub-folders: its own pages first, then one expandable row per sub-folder. */
function NestedFolderRow({ folder, subs, openFolder, setOpenFolder, userId, current }: { folder: { id: string; label: string; docs: { slug: string; title: string }[] }; subs: { id: string; label: string; docs: { slug: string; title: string }[] }[]; openFolder: string | null; setOpenFolder: (id: string | null) => void; userId: string; current?: string }) {
  const open = openFolder === folder.id || (openFolder?.startsWith(folder.id + "/") ?? false) || subs.some((s) => s.id === openFolder);
  return (
    <div>
      <BigRow label={folder.label} open={open} onToggle={() => setOpenFolder(open ? null : folder.id)} />
      {open && (
        <div className="mb-4 mt-1">
          <ul className="space-y-0.5">
            {folder.docs.map((d) => (
              <li key={d.slug}><DocItem href={docUrl(userId, d.slug)} title={d.title} active={current === d.slug} /></li>
            ))}
          </ul>
          {subs.map((s) => {
            const subOpen = openFolder === s.id;
            if (s.docs.length === 1) return <SubLinkRow key={s.id} label={s.label} href={docUrl(userId, s.docs[0].slug)} active={current === s.docs[0].slug} />;
            return (
              <div key={s.id} className="mt-1 border-l border-overlay/10 pl-3">
                <button type="button" onClick={() => setOpenFolder(subOpen ? folder.id : s.id)} aria-expanded={subOpen} className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-overlay/5">
                  <span className="font-display text-2xl leading-tight tracking-[-0.02em] text-ink">{s.label}</span>
                  <ChevronRight className={`h-4 w-4 text-ink transition-transform ${subOpen ? "rotate-90" : ""}`} />
                </button>
                {subOpen && (
                  <ul className="mb-2 mt-0.5 space-y-0.5">
                    {s.docs.map((d) => (
                      <li key={d.slug}><DocItem href={docUrl(userId, d.slug)} title={d.title} active={current === d.slug} /></li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A sub-folder row that holds one page: opens the page directly (same look as the expandable sub-folder row). */
function SubLinkRow({ label, href, active }: { label: string; href: string; active: boolean }) {
  const { pending, onClick } = useLinkPending(href);
  return (
    <div className="mt-1 border-l border-overlay/10 pl-3">
      <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} aria-busy={pending} className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left">
        <span className="font-display text-2xl leading-tight tracking-[-0.02em] text-ink">{label}</span>
        {pending ? <span className="flex h-4 w-4 items-center justify-center"><TickSpinner size={16} label="Loading page" /></span> : <ChevronRight className={`h-4 w-4 ${active ? "text-[#306fdb]" : "text-ink"}`} />}
      </Link>
    </div>
  );
}

/** A direct-link row (big heading, divider, chevron) for a syllabus chapter. */
function LinkRow({ label, href, active }: { label: string; href: string; active: boolean }) {
  const { pending, onClick } = useLinkPending(href);
  return (
    <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} aria-busy={pending} className="group flex w-full items-center justify-between py-3">
      <span className="font-display text-[34px] leading-[1.1] tracking-[-0.035em] text-ink transition-opacity group-hover:opacity-70 sm:text-4xl sm:leading-tight sm:tracking-[-0.03em]">{label}</span>
      <span className="flex items-center gap-4">
        <span aria-hidden className="h-9 w-px bg-overlay/15" />
        {pending ? (
          <span className="flex h-5 w-5 items-center justify-center"><TickSpinner size={20} label="Loading page" /></span>
        ) : (
          <ChevronRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 ${active ? "text-[#306fdb]" : "text-ink"}`} />
        )}
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
  // Top-level folders only; a sub-folder (e.g. "leadership-principles/amazon") is listed inside its parent.
  const folders = all.filter((f) => f.id !== "research" && f.id !== "syllabus" && !f.id.startsWith("syllabus/") && f.id !== "interview" && !f.id.includes("/") && !(f.id in FOLDER_PARENT));
  // Sub-folders: by path ("leadership-principles/amazon"), plus folders listed in FOLDER_PARENT (DAA notes sits under Project docs).
  const subFolders = (parentId: string) => all.filter((f) => (parentId !== "" && f.id.startsWith(parentId + "/")) || FOLDER_PARENT[f.id] === parentId);
  const interview = all.find((f) => f.id === "interview");
  const syllabus = all.find((f) => f.id === "syllabus");
  // Chapters that hold several pages (e.g. "System Design" with System Design 1, 2 …) are sub-folders of docs/syllabus.
  const syllabusGroups = all.filter((f) => f.id.startsWith("syllabus/"));
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
                    <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-overlay/10 bg-canvas-raised text-ink md:h-auto md:w-auto md:border-0 md:bg-transparent md:p-2">
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <nav className="flex-1 overflow-y-auto px-6 pb-8 pt-4" aria-label="Notes navigation">
                    {syllabus && (
                      <section aria-label="Syllabus" className={SECTION}>
                        <div className={LABEL}>Syllabus</div>
                        {[
                          ...syllabus.docs
                            .filter((d) => !HIDDEN_IN_MENU.has(d.slug))
                            .map((d) => ({ key: d.slug, order: syllabusOrder(d.slug), doc: d, group: undefined as (typeof syllabusGroups)[number] | undefined })),
                          ...syllabusGroups.map((g) => ({ key: g.id, order: syllabusOrder(g.id), doc: undefined, group: g })),
                        ]
                          .sort((a, b) => a.order - b.order)
                          .map(({ key, doc: d, group }) => {
                            if (group) {
                              return <FolderRow key={key} label={group.label} docs={group.docs} open={openFolder === group.id} onToggle={() => setOpenFolder(openFolder === group.id ? null : group.id)} userId={userId} current={current} />;
                            }
                            if (!d) return null;
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
                        {folders.map((f) =>
                          subFolders(f.id).length > 0 ? (
                            <NestedFolderRow key={f.id || "root"} folder={f} subs={subFolders(f.id)} openFolder={openFolder} setOpenFolder={setOpenFolder} userId={userId} current={current} />
                          ) : (
                            <FolderRow key={f.id || "root"} label={f.label} docs={f.docs} open={openFolder === f.id} onToggle={() => setOpenFolder(openFolder === f.id ? null : f.id)} userId={userId} current={current} />
                          )
                        )}
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
